# CONTENT_STRATEGY.md

Dos partes: la **guía de estilo del español paraguayo** (aplica a toda cadena visible del sitio, no sólo al blog) y el **plan editorial**.

---

# PARTE 1 — Guía de estilo

## 1.1 Registro

Español paraguayo, cercano y directo. Se le habla a una persona real que está mirando el celular, no a un "usuario".

- **Voseo**, que es lo natural en Paraguay: *podés*, *tenés*, *fijate*, *escribinos*, *mirá*, *contactá*, *publicá*.
  - Sí: "Publicá tu moto gratis", "Fijate que los papeles estén al día", "Escribinos por WhatsApp".
  - No: "Publica tu moto gratis" (neutro/tuteo), "Publicad" (España), "Usted puede publicar" (distante).
- **Sin tuteo, sin ustedeo.** El "usted" sólo aparece en textos legales.
- **Sin españolismos:** nada de *coche*, *vale*, *móvil*, *ordenador*, *conducir* (se usa *manejar*).
- **Sin mexicanismos ni argentinismos marcados:** no *carro*, no *checar*, no *pibe*.
- **Guaraní y jopara:** no se usan en la interfaz ni en el contenido principal. Es tentador y suena local, pero excluye lectores y complica el SEO. Puede aparecer un guiño puntual en contenido de marca, nunca en un botón ni en un título.

## 1.2 Vocabulario del rubro

| Usar | No usar |
|---|---|
| moto | motocicleta (salvo en textos legales) |
| en cuotas | en mensualidades, a plazos |
| entrega | enganche, pie, anticipo |
| chapa | patente, matrícula |
| transferencia | traspaso |
| taller | garaje, mecánica |
| repuestos | refacciones, recambios |
| seguro contra terceros | seguro de responsabilidad civil (salvo legal) |
| 0 km | nueva de paquete, cero kilómetros |
| usada | de segunda mano, seminueva |
| cilindrada | cilindraje |
| casco | protección de cabeza |
| manejar | conducir |

**Regla de verificación:** estos términos deben confirmarse con al menos un comercio real antes de fijar las etiquetas de la interfaz. Marcar `[VERIFICAR]` lo que no se pudo confirmar. Un término equivocado en un filtro se nota inmediatamente y resta credibilidad.

## 1.3 Formatos

| Elemento | Formato | Ejemplo |
|---|---|---|
| Moneda | `Gs.` + punto de miles, sin decimales | `Gs. 12.500.000` |
| Financiación | Entrega + cuotas | `Entrega Gs. 2.000.000 + 24 cuotas de Gs. 650.000` |
| Fecha | `d/m/aaaa` | `3/8/2026` |
| Fecha larga | | `3 de agosto de 2026` |
| Teléfono visible | | `0981 123 456` |
| Teléfono almacenado | E.164 | `+595981123456` |
| Kilometraje | Punto de miles + `km` | `12.500 km` |
| Cilindrada | | `150 cc` |
| Año | Cuatro dígitos | `2022` |
| Hora | 24 h | `14:30` |

Acentos correctos siempre, incluido en mayúsculas: *Asunción*, *Ciudad del Este*, *Encarnación*, *Ñemby*, *Itapúa*.

## 1.4 Botones y microcopy

| Contexto | Texto |
|---|---|
| Contacto principal | **Escribir por WhatsApp** |
| Ver teléfono | **Ver teléfono** |
| Publicar | **Publicá tu moto gratis** |
| Financiación | **Quiero financiarla** |
| Enviar formulario | **Enviar consulta** |
| Filtrar | **Filtrar** / **Limpiar filtros** |
| Denunciar | **Denunciar esta publicación** |

Prohibidos: "Contactar" (frío y no dice el canal), "Click aquí", "Enviar" a secas, signos de exclamación múltiples, MAYÚSCULAS gritadas, y toda urgencia falsa (`PLAN.md` §5).

## 1.5 Cómo se habla de financiación

Se explica cómo funciona; nunca se asesora ni se promete.

- Sí: "Los comercios suelen pedir una entrega y financiar el resto en cuotas."
- Sí: "Te derivamos con el comercio o la financiera."
- No: "Te conseguimos la mejor tasa."
- No: "Aprobación garantizada" / "sin informconf" / "sin veraz".
- No: cuotas calculadas por nosotros presentadas como oferta.

Toda página de financiación lleva el descargo de `PRODUCT_SPEC.md` §2.3.

## 1.6 Textos de rechazo de publicación

Uno por código (`TRUST_AND_SAFETY.md` §4). Fórmula: qué pasó → cómo arreglarlo → invitación a reenviar. Nunca acusatorio.

Ejemplos:
- `sin_fotos`: "No pudimos publicar tu moto porque las fotos no se ven bien. Sacá 3 o 4 fotos con buena luz, de frente, de costado y del tablero, y volvé a enviarla. Cualquier cosa, escribinos."
- `fotos_ajenas`: "Las fotos que subiste parecen tomadas de otro sitio. Necesitamos fotos de tu moto para publicarla. Subí las tuyas y la revisamos de nuevo."
- `sospecha_fraude`: "No vamos a publicar esta moto porque no cumple con nuestras normas de seguridad. Si creés que es un error, escribinos y lo revisamos." *(Nunca explicar qué señal se detectó: es un manual para el próximo estafador.)*

## 1.7 Contenido asistido por IA

Permitido para borradores. **Obligatorio:** revisión humana (`posts.reviewed_by`) antes de publicar. El revisor verifica que no haya datos inventados, que el español sea paraguayo, que ningún precio o estadística carezca de fuente, y que no se prometa nada que no podamos cumplir. Contenido con `[VERIFICAR]` sin resolver no se publica.

---

# PARTE 2 — Plan editorial

## 2.1 Para qué sirve el contenido acá

Tres funciones, en orden de importancia:
1. **Captar intención de trámite y de compra** — quien busca "transferencia de chapa" está comprando o vendiendo una moto ahora.
2. **Sostener las páginas de listado** — enlazado interno hacia marca, modelo y ciudad.
3. **Dar sustancia** a un sitio que al principio tiene poco inventario (`DATA_SEEDING.md` §8, plan B).

## 2.2 Reglas

- Una consulta, una página. Antes de escribir, verificar que no compita con un listado existente (`SEO_ARCHITECTURE.md` §11).
- Toda guía enlaza a al menos dos listados relevantes con anclaje descriptivo.
- Todo dato verificable (costos de trámite, requisitos, oficinas) se marca `[VERIFICAR: fuente]` y no se publica sin confirmar. Los trámites y aranceles cambian; publicar un monto viejo destruye confianza.
- Sin listas de "las 10 mejores motos" con posiciones inventadas ni comparativas sin criterio explícito.
- Sin precios de mercado afirmados salvo que salgan de nuestras propias publicaciones, indicando el N.
- Cada guía lleva fecha de publicación y de última actualización visibles.

## 2.3 Las 10 guías fundacionales (fase 1)

| # | Título de trabajo | Consulta objetivo | Intención | Enlaza a |
|---|---|---|---|---|
| 1 | Cómo transferir una moto en Paraguay: pasos y papeles | `transferencia de chapa moto paraguay` | Trámite | Usadas, ciudad |
| 2 | Cómo comprar una moto usada sin que te estafen | `comprar moto usada paraguay` | Precaución | Usadas, `TRUST_AND_SAFETY` |
| 3 | Comprar una moto en cuotas en Paraguay: cómo funciona | `motos en cuotas paraguay` | Comercial alta | `/motos/en-cuotas`, `/financiacion` |
| 4 | Qué papeles tiene que tener una moto al día | `papeles moto paraguay` | Trámite | Usadas |
| 5 | Seguro contra terceros para motos: qué cubre | `seguro moto paraguay` | Comercial | `/seguros` |
| 6 | Qué moto conviene para trabajar (delivery y ciudad) | `mejor moto para delivery paraguay` | Comparación | Categorías |
| 7 | Cuánto cuesta mantener una moto por mes | `mantenimiento moto costo` | Informativa | Talleres, guías |
| 8 | 125, 150 o 200 cc: cuál te sirve | `que cilindrada de moto elegir` | Comparación | Categorías, modelos |
| 9 | Cómo sacar buenas fotos para vender tu moto | `como vender mi moto rapido` | Vendedor | `/publicar` |
| 10 | Qué revisar antes de comprar una moto usada (checklist) | `que revisar moto usada` | Precaución | Usadas |

Las guías 1, 2, 3 y 4 son las de mayor valor: intención altísima y competencia local floja. Se escriben primero.

## 2.4 Fases posteriores

- **Fase 2:** una guía por marca principal (historia, modelos disponibles en Paraguay, repuestos, qué mirar). Enlaza a la página de marca.
- **Fase 3:** guías por ciudad (dónde comprar, talleres, particularidades del trámite) — sólo donde haya inventario real que sostenga la página.
- **Fase 4+:** contenido de modelo específico donde Search Console muestre demanda real. Los datos guían, no la intuición.

## 2.5 Cadencia realista

Con presupuesto cercano a cero (ADR-14): **2 a 4 artículos por mes**, bien hechos, sobre 20 malos. Es más eficaz y es lo único sostenible para una persona.

## 2.6 Qué NO se publica

- Noticias de motos (rueda de ardilla sin retorno).
- Contenido genérico sin ángulo paraguayo — hay miles de artículos en español mejor posicionados.
- Comparativas de modelos que no se consiguen en Paraguay.
- Cualquier cosa con datos inventados o estadísticas sin fuente (`PLAN.md` §5).
