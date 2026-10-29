-- Deshace 20261028_recepcion_importaciones.sql. Solo usar si hay que volver atrás.
-- Atención: las cantidades ya confirmadas con recepción parcial NO vuelven a la cantidad pedida
-- (el stock se sumó con lo recibido y debe quedar así).

begin;

drop trigger if exists trigger_registrar_recepcion on public.movimientos;
drop function if exists public.registrar_recepcion();

-- La vista debe volver a su forma original antes de quitar las columnas que usa
drop view if exists public.importaciones_resumen;
create view public.importaciones_resumen as
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
    end as estado
from public.importaciones i
left join public.movimientos m on m.importacion_id = i.id
group by i.id;

alter table public.movimientos
  drop column if exists recibido_at,
  drop column if exists recibido_por,
  drop column if exists cantidad_esperada;

commit;
