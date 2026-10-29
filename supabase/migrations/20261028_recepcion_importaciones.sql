-- Recepción de entradas: quién recibió, cuándo y cuántas unidades llegaron realmente.
--
-- Cómo funciona:
--   * recibido_at / recibido_por se llenan SOLOS en el servidor al confirmar una entrada
--     (o al crearla ya confirmada). La app no puede escribirlos ni modificarlos.
--   * Si al confirmar se envía una cantidad distinta a la pedida, la pedida queda guardada en
--     cantidad_esperada y "cantidad" pasa a ser lo que realmente llegó. El trigger existente
--     confirmar_entrada_transito suma new.cantidad al stock, así que el stock refleja lo recibido.
--   * Las entradas antiguas se completan desde la tabla auditoria (o desde su fecha de creación
--     si se registraron ya confirmadas).
--
-- Se ejecuta completo dentro de una transacción: si algo falla, no se aplica nada.

begin;

-- 1. Columnas nuevas (todas opcionales; no afectan a los registros existentes)
alter table public.movimientos
  add column if not exists recibido_at timestamptz,
  add column if not exists recibido_por uuid references public.usuarios(id) on delete set null,
  add column if not exists cantidad_esperada integer;

-- 2. Completar datos de entradas ya confirmadas.
--    Se desactiva temporalmente la auditoría para no llenarla con cientos de "Editó" artificiales.
alter table public.movimientos disable trigger audit_movimientos;

-- 2a. Entradas que pasaron de en_transito a confirmado: fecha y usuario de esa confirmación
update public.movimientos m
set recibido_at = a.created_at,
    recibido_por = (select u.id from public.usuarios u where u.id = a.usuario_id)
from (
  select distinct on (registro_id) registro_id, created_at, usuario_id
  from public.auditoria
  where tabla = 'movimientos'
    and accion = 'update'
    and datos_anteriores ->> 'estado' = 'en_transito'
    and datos_nuevos ->> 'estado' = 'confirmado'
  order by registro_id, created_at
) a
where a.registro_id = m.id
  and m.tipo = 'entrada'
  and m.estado = 'confirmado'
  and m.recibido_at is null;

-- 2b. Entradas registradas directamente como confirmadas: se recibieron al crearse
update public.movimientos m
set recibido_at = m.created_at,
    recibido_por = (select u.id from public.usuarios u where u.id = m.usuario_id)
where m.tipo = 'entrada'
  and m.estado = 'confirmado'
  and m.recibido_at is null
  and not exists (
    select 1 from public.auditoria a
    where a.tabla = 'movimientos'
      and a.registro_id = m.id
      and a.datos_anteriores ->> 'estado' = 'en_transito'
  );

alter table public.movimientos enable trigger audit_movimientos;

-- 3. Trigger que sella la recepción en el servidor
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
    return new;
  end if;

  -- UPDATE: confirmación de una entrada en tránsito
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

drop trigger if exists trigger_registrar_recepcion on public.movimientos;
create trigger trigger_registrar_recepcion
  before insert or update on public.movimientos
  for each row execute function public.registrar_recepcion();

-- 4. Resumen de importaciones: se agregan columnas al final (las existentes no cambian)
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
left join public.movimientos m on m.importacion_id = i.id
group by i.id;

commit;

-- Comprobación (opcional, solo lectura): cuántas entradas quedaron con datos de recepción
-- select estado, count(*) total, count(recibido_at) con_fecha, count(recibido_por) con_usuario
-- from public.movimientos where tipo = 'entrada' group by estado;
