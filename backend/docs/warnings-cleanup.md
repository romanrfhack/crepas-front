# Warnings cleanup trade-offs

## Decisiones principales

- **Domain / CA1720 (`SelectionMode.Single`)**: se mantuvo el nombre `Single` para evitar cualquier riesgo sobre contratos/API serializados y se aplicó una supresión localizada con justificación de dominio.
- **Migrations**: se prefirió **supresión por carpeta** (`CA1861`, `IDE0005`) en `.editorconfig` para evitar churn en archivos generados por EF.
- **Tests**:
  - se retiró `ConfigureAwait(false)` para alinearse con `xUnit1030`.
  - se suprimen `CA1707` y `CA2007` por carpeta de tests vía `.editorconfig` para respetar el estilo actual (nombres con underscore) y no forzar patrones de await no recomendados por xUnit.
- **Logging de performance**: donde había logging estructurado repetitivo en servicios POS, se migró a `LoggerMessage.Define` con delegates dedicados para reducir costo de boxing/params arrays (`CA1848`/`CA1873`) sin cambiar mensajes ni semántica.

## Nota de entorno

No fue posible ejecutar `dotnet build`/`dotnet test` en este entorno porque `dotnet` no está instalado en la imagen actual.
