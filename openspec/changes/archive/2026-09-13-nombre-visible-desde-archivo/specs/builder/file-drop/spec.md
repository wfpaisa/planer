## ADDED Requirements

### Requirement: Lo que nace de un archivo se nombra para leerse

Una tabla creada desde un archivo SHALL tomar su nombre visible del nombre del archivo, y una columna creada desde una cabecera SHALL tomarlo de la cabecera. En los dos casos, cuando el texto venga escrito como nombre técnico --todo en minúsculas, con guiones o guiones bajos en lugar de espacios-- SHALL convertirse a nombre legible: los separadores pasan a espacios y la primera letra a mayúscula.

Esto SHALL valer tanto al crear una tabla como al añadir columnas a una tabla que ya existe.

Un texto que no venga escrito como nombre técnico SHALL respetarse: uno que ya trae espacios, y uno que trae mayúsculas propias.

El nombre técnico SHALL seguir saliendo del nombre visible, como en cualquier tabla o columna creada desde el panel. Lo que cambia es el nombre visible con el que nace, no cómo se deriva el técnico.

Las tablas y columnas ya guardadas SHALL NO cambiar de nombre.

#### Scenario: Un archivo exportado vuelve como tabla nueva

- **WHEN** se suelta `chequeo-preoperacional.csv` y no corresponde a ninguna tabla existente
- **THEN** la tabla nace llamándose "Chequeo preoperacional"

#### Scenario: Las cabeceras técnicas del archivo exportado

- **WHEN** ese archivo trae una cabecera `codigo_empleado`
- **THEN** la columna nace llamándose "Codigo empleado"

#### Scenario: Un nombre que ya se lee bien

- **WHEN** se suelta `Chequeo Preoperacional.csv`
- **THEN** la tabla nace con ese nombre tal cual, sin bajar las mayúsculas

#### Scenario: Un nombre con sigla

- **WHEN** una cabecera del archivo es `IVA_2026`
- **THEN** la columna nace con ese texto tal cual, porque sus mayúsculas son suyas

#### Scenario: Añadir columnas a una tabla que ya existe

- **WHEN** se importa un archivo con una cabecera `fecha_revision` que la tabla no tiene
- **THEN** la columna que se ofrece crear se llama "Fecha revision"
