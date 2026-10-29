-- Anulación de movimientos sin borrarlos.
--
-- Cómo funciona:
--   * Un administrador llama a anular_movimiento(id, motivo). La función revierte el efecto del
--     movimiento en el stock y lo marca como anulado (quién, cuándo y por qué). El registro no se borra.
--   * Si revertir deja stock negativo (por ejemplo, se anula una entrada cuyas unidades ya se vendieron),
--     ajustar_stock_almacen lanza STOCK_INSUFICIENTE y no se anula nada.
--   * Los datos de anulación solo los puede escribir esta función; una edición directa no los cambia.
--   * Un movimiento anulado ya no se puede confirmar ni volver a anular.
--   * La salida de un kit se revierte con la receta ACTUAL del kit (no se guarda la receta histórica).
--
-- Requiere haber aplicado antes 20261028_recepcion_importaciones.sql.
-- Se ejecuta completo dentro de una transacción: si algo falla, no se aplica nada.

begin;

-- 1. Columnas nuevas (opcionales; no afectan a los registros existentes)
alter table public.movimientos
  add column if not exists anulado_at timestamptz,
  add column if not exists anulado_por uuid references public.usuarios(id) on delete set null,
  add column if not exists motivo_anulacion text;

-- 2. Trigger de recepción ampliado: además protege los datos de anulación
create or replace function public.registrar_recepcion()
returns trigger
language plpgsql
as $function$
begin
  if tg_op = 'INSERT' then
    if new.tipo = 'entrada' and new.estado = 'confirmado' then
      new.recibido_at := now();
      new.recibido_por := (select u.id from public.usuarios u where u.id = coalesce(auth.uid(), new.usuario_id));
    else
      new.recibido_at := null;
      new.recibido_por := null;
    end if;
    new.cantidad_esperada := null;
    new.anulado_at := null;
    new.anulado_por := null;
    new.motivo_anulacion := null;
    return new;
  end if;

  -- UPDATE
  if old.anulado_at is not null and new.estado is distinct from old.estado then
    raise exception 'MOVIMIENTO_ANULADO: este movimiento está anulado y no se puede modificar.';
  end if;

  -- Los datos de anulación solo cambian desde anular_movimiento()
  if coalesce(current_setting('app.anulando_movimiento', true), '') <> new.id::text then
    new.anulado_at := old.anulado_at;
    new.anulado_por := old.anulado_por;
    new.motivo_anulacion := old.motivo_anulacion;
  end if;

  -- Confirmación de una entrada en tránsito
  if new.tipo = 'entrada' and old.estado = 'en_transito' and new.estado = 'confirmado' then
    if new.cantidad is null or new.cantidad < 1 then
      raise exception 'CANTIDAD_RECIBIDA_INVALIDA: la cantidad recibida debe ser al menos 1.';
    end if;
    new.recibido_at := now();
    new.recibido_por := (select u.id from public.usuarios u where u.id = auth.uid());
    if new.cantidad <> old.cantidad then
      new.cantidad_esperada := old.cantidad;
    else
      new.cantidad_esperada := old.cantidad_esperada;
    end if;
  else
    -- Cualquier otra edición no puede alterar los datos de recepción
    new.recibido_at := old.recibido_at;
    new.recibido_por := old.recibido_por;
    new.cantidad_esperada := old.cantidad_esperada;
  end if;
  return new;
end;
$function$;

-- 3. Función de anulación
create or replace function public.anular_movimiento(p_movimiento_id uuid, p_motivo text)
returns void
language plpgsql
as $function$
declare
  v_usuario uuid := auth.uid();
  m public.movimientos%rowtype;
  v_tipo_producto text;
  comp record;
begin
  if v_usuario is null or not exists (
    select 1 from public.usuarios where id = v_usuario and rol = 'admin'
  ) then
    raise exception 'SOLO_ADMIN: solo un administrador puede anular movimientos.';
  end if;

  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'MOTIVO_REQUERIDO: indica el motivo de la anulación.';
  end if;

  -- Bloquea la fila: dos anulaciones simultáneas no pueden revertir dos veces
  select * into m from public.movimientos where id = p_movimiento_id for update;
  if not found then
    raise exception 'MOVIMIENTO_NO_EXISTE: el movimiento no existe.';
  end if;
  if m.anulado_at is not null then
    raise exception 'YA_ANULADO: este movimiento ya fue anulado.';
  end if;

  select tipo into v_tipo_producto from public.productos where id = m.producto_id;

  -- Revertir exactamente lo que hizo actualizar_stock() / confirmar_entrada_transito()
  if m.tipo = 'entrada' then
    if m.estado = 'confirmado' then
      perform public.ajustar_stock_almacen(m.producto_id, m.almacen_id, -m.cantidad);
    end if;
    -- Una entrada en tránsito nunca sumó stock: solo se marca como anulada

  elsif m.tipo = 'salida' then
    if v_tipo_producto = 'kit' then
      for comp in
        select componente_id, cantidad from public.producto_componentes where kit_id = m.producto_id
      loop
        perform public.ajustar_stock_almacen(comp.componente_id, m.almacen_id, comp.cantidad * m.cantidad);
      end loop;
    else
      perform public.ajustar_stock_almacen(m.producto_id, m.almacen_id, m.cantidad);
    end if;

  elsif m.tipo = 'transferencia' then
    perform public.ajustar_stock_almacen(m.producto_id, m.almacen_destino_id, -m.cantidad);
    perform public.ajustar_stock_almacen(m.producto_id, m.almacen_origen_id, m.cantidad);
  end if;

  perform set_config('app.anulando_movimiento', m.id::text, true);
  update public.movimientos
  set anulado_at = now(),
      anulado_por = v_usuario,
      motivo_anulacion = trim(p_motivo)
  where id = m.id;
  perform set_config('app.anulando_movimiento', '', true);
end;
$function$;

revoke all on function public.anular_movimiento(uuid, text) from public, anon;
grant execute on function public.anular_movimiento(uuid, text) to authenticated;

-- 4. El resumen de importaciones ignora las líneas anuladas (mismas columnas que antes)
create or replace view public.importaciones_resumen as
select i.id,
    i.codigo,
    i.proveedor,
    i.fecha_llegada_estimada,
    i.created_at,
    count(m.id) as total_lineas,
    count(m.id) filter (where m.estado = 'confirmado') as lineas_confirmadas,
    coalesce(sum(m.cantidad), 0::bigint) as total_unidades,
    case
        when count(m.id) = 0 then 'sin_movimientos'
        when count(m.id) filter (where m.estado = 'confirmado') = 0 then 'en_transito'
        when count(m.id) filter (where m.estado = 'confirmado') = count(m.id) then 'confirmado'
        else 'parcial'
    end as estado,
    coalesce(sum(coalesce(m.cantidad_esperada, m.cantidad)), 0::bigint) as unidades_esperadas,
    max(m.recibido_at) as ultima_recepcion
from public.importaciones i
left join public.movimientos m on m.importacion_id = i.id and m.anulado_at is null
group by i.id;

commit;
