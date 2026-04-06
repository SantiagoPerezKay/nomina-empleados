# Análisis: Soporte de Horarios Cortados en el Backend

## Veredicto: ❌ NO lo contempla

El sistema actual **NO soporta horarios cortados (split shifts)**. Está diseñado para un modelo simplista de un único bloque horario por turno.

---

## Problemas Detectados

### 1. Modelo `Turno` — Solo un bloque horario

```python
# models.py líneas 78-87
class Turno(Base):
    hora_entrada = Column(Time)  # ← UNA sola entrada
    hora_salida  = Column(Time)  # ← UNA sola salida
```

> [!CAUTION]
> El turno solo tiene `hora_entrada` y `hora_salida`. **No puede representar** un vendedor que trabaja **8:30–12:30** y luego **16:30–20:30** porque no hay campos para el segundo bloque.

---

### 2. Modelo `AsignacionTurno` — Sin variación por día de la semana

```python
# models.py líneas 90-98
class AsignacionTurno(Base):
    empleado_id  = Column(Integer, ForeignKey("empleados.id"))
    turno_id     = Column(Integer, ForeignKey("turnos.id"))
    fecha_desde  = Column(Date)
    fecha_hasta  = Column(Date)
```

> [!CAUTION]
> No hay campo `dia_semana`. No se puede decir "Lunes a Viernes turno X, Sábado turno Y". La asignación aplica uniformemente a todo el rango de fechas.

---

### 3. Modelo `Asistencia` — Solo un registro de entrada/salida por día

```python
# asistencias.py líneas 44-51 (crear_manual)
existe = await db.execute(
    select(Asistencia).where(
        Asistencia.empleado_id == body.empleado_id,
        Asistencia.fecha == body.fecha,
    )
)
if existe.scalars().first():
    raise HTTPException(400, "Ya existe un registro de asistencia para ese empleado en esa fecha")
```

```python
# asistencias.py líneas 68-72 (check_in)
existe = await db.execute(
    select(Asistencia).where(Asistencia.empleado_id == empleado_id, Asistencia.fecha == hoy)
)
if existe.scalars().first():
    raise HTTPException(400, "El empleado ya registró entrada hoy")
```

> [!CAUTION]
> **Bloqueo explícito**: El código impide crear más de un registro de asistencia por empleado por día. Un vendedor con horario cortado necesita registrar **dos entradas y dos salidas** en el mismo día, y el sistema lo rechaza.

---

### 4. Check-out — Mismo problema

```python
# asistencias.py líneas 107-115 (check_out)
r = await db.execute(
    select(Asistencia).where(Asistencia.empleado_id == empleado_id, Asistencia.fecha == hoy)
)
asistencia = r.scalars().first()  # ← toma el PRIMER registro
```

Solo busca el primer registro del día. Si hubiera dos bloques, no sabría cuál cerrar.

---

## Escenarios de tu empresa que NO funcionan

| Escenario | ¿Funciona? | Motivo |
|---|---|---|
| Vendedor: 8:30–12:30 + 16:30–20:30 (L-V) | ❌ | Un turno solo tiene 1 bloque; asistencia rechaza 2do check-in |
| Administrativo: 8:30–17:00 corrido (L-V) | ✅ | Encaja en el modelo actual |
| Sábado: 9:00–13:00 (4hs corridas) | ⚠️ | Funciona si se crea otro turno, pero no se puede asignar solo para sábados |
| Sábado cortado: 8:30–12:30 + 16:30–20:30 | ❌ | Doble problema: no soporta horario cortado ni día específico |

---

## Solución Propuesta

Para soportar todos los escenarios se necesita rediseñar 3 cosas:

### A. Nuevo modelo: `BloqueHorario` (reemplaza hora_entrada/salida en Turno)

```
Turno (nombre: "Vendedor L-V")
  └── BloqueHorario (orden=1, hora_entrada=08:30, hora_salida=12:30)
  └── BloqueHorario (orden=2, hora_entrada=16:30, hora_salida=20:30)

Turno (nombre: "Admin corrido")
  └── BloqueHorario (orden=1, hora_entrada=08:30, hora_salida=17:00)

Turno (nombre: "Sábado corto")
  └── BloqueHorario (orden=1, hora_entrada=09:00, hora_salida=13:00)
```

### B. Agregar `dia_semana` a `AsignacionTurno`

Permitir asignar turnos diferentes por día:
- Empleado → Turno "Vendedor L-V" → Lunes a Viernes
- Empleado → Turno "Sábado corto" → Sábado

### C. Modificar lógica de `Asistencia`

- Permitir **múltiples registros de asistencia por día** (uno por bloque)
- Agregar campo `bloque_horario_id` para saber a qué bloque corresponde cada check-in/check-out
- Ajustar lógica de tardanza para evaluar contra el bloque correcto

---

## Archivos que necesitan modificación

| Archivo | Cambios |
|---|---|
| [models.py](file:///c:/Users/santy/Desktop/trabajo/nomina-empleados/backend/app/models/models.py) | Nuevo modelo `BloqueHorario`, agregar `dia_semana` a `AsignacionTurno`, agregar `bloque_id` a `Asistencia` |
| [schemas.py](file:///c:/Users/santy/Desktop/trabajo/nomina-empleados/backend/app/schemas/schemas.py) | Schemas para `BloqueHorario`, actualizar `TurnoCreate/Out`, `AsignacionTurnoCreate/Out`, `AsistenciaCreate/Out` |
| [asistencias.py](file:///c:/Users/santy/Desktop/trabajo/nomina-empleados/backend/app/routers/asistencias.py) | Reescribir check-in/check-out para soportar múltiples bloques por día |
| [general.py](file:///c:/Users/santy/Desktop/trabajo/nomina-empleados/backend/app/routers/general.py) | Endpoints CRUD para bloques horarios, actualizar asignación de turnos |
