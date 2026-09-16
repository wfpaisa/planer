## ADDED Requirements

### Requirement: El contexto dice quién escribe la petición

El contexto SHALL decir que quien escribe la petición es el dueño de la aplicación, y que dentro de la aplicación su rol es `admin`.

El contexto SHALL decir además que `admin` existe en toda aplicación desde que nace y no se puede quitar, para que la equivalencia valga en cualquier aplicación y no solo en las que hayan nombrado ese rol a mano.

El contexto SHALL presentarlo como un hecho de la plataforma, no como una instrucción: ser dueño de la aplicación es lo que da el poder de construirla, y `admin` es solo el nombre del rol que le corresponde dentro de ella.

Por ser un hecho, SHALL llegar igual a la documentación del constructor y al contexto de la IA.

#### Scenario: Aplicación que no nombró roles a mano

- **WHEN** se arma el contexto de una aplicación cuyos roles son solo los que trae de nacimiento
- **THEN** el contexto nombra `admin` como el rol de quien escribe

#### Scenario: La documentación del constructor

- **WHEN** el constructor consulta la documentación de cómo se escribe una página
- **THEN** encuentra dicho que su rol dentro de la aplicación es `admin`

### Requirement: La instrucción de cómo leer la petición es solo para el modelo

El contexto SHALL llevar, solo cuando se arma para la IA, la instrucción de cómo deducir para quién es una pantalla a partir de las palabras de la petición.

Esa instrucción SHALL NO aparecer en la documentación del constructor: es una regla de lectura para el modelo, no algo que quien construye tenga que saber.

#### Scenario: Contexto armado para la IA

- **WHEN** se arma el contexto de una petición a la IA
- **THEN** incluye la regla de cómo leer para quién es la pantalla

#### Scenario: Documentación del constructor

- **WHEN** se genera la documentación de cómo se escribe una página
- **THEN** no incluye esa regla de lectura
