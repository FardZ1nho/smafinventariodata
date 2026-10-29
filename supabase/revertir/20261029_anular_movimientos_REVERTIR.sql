-- Deshace 20261029_anular_movimientos.sql. Solo usar si hay que volver atrás.
-- Atención: los movimientos ya anulados conservan su efecto en el stock (ya se revirtió);
-- al quitar las columnas se pierde el registro de quién, cuándo y por qué se anularon.

begin;

drop function if exists public.anular_movimiento(uuid, text);

-- Vista y trigger vuelven a su versión de 20261028_recepcion_importaciones.sql
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
    new.recibido_at := old.recibido_at;
    new.recibido_por := old.recibido_por;
    new.cantidad_esperada := old.cantidad_esperada;
  end if;
  return new;
end;
$function$;

alter table public.movimientos
  drop column if exists anulado_at,
  drop column if exists anulado_por,
  drop column if exists motivo_anulacion;

commit;
