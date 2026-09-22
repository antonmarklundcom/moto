# Checklist de vocabulario para la primera llamada a un comercio (H-9)

`CONTENT_STRATEGY.md` §1.2 dice: "estos términos deben confirmarse con al
menos un comercio real antes de fijar las etiquetas de la interfaz". Esta
lista junta los tres grupos de términos que hoy están fijados sin esa
confirmación — vocabulario del rubro, nombres de categoría, y las etiquetas
de estado de documentación de G-4 — para que el propietario los repase en
una sola llamada. Nada de esto se decide en R0: es investigación de
documentos internos (`CONTENT_STRATEGY.md`, `DATABASE_SCHEMA.md`), no de
fuentes externas, así que no lleva URLs.

Formato por ítem: término candidato → qué reemplaza → casilla para marcar en
la llamada.

## 1. Vocabulario del rubro (`CONTENT_STRATEGY.md` §1.2)

| # | Usar (candidato) | En vez de | ¿Lo usa así el comercio? |
|---|---|---|---|
| 1 | moto | motocicleta (salvo legal) | [ ] Sí &nbsp; [ ] No, dice: _______ |
| 2 | en cuotas | en mensualidades, a plazos | [ ] Sí &nbsp; [ ] No, dice: _______ |
| 3 | entrega | enganche, pie, anticipo | [ ] Sí &nbsp; [ ] No, dice: _______ |
| 4 | chapa | patente, matrícula | [ ] Sí &nbsp; [ ] No, dice: _______ |
| 5 | transferencia | traspaso | [ ] Sí &nbsp; [ ] No, dice: _______ |
| 6 | taller | garaje, mecánica | [ ] Sí &nbsp; [ ] No, dice: _______ |
| 7 | repuestos | refacciones, recambios | [ ] Sí &nbsp; [ ] No, dice: _______ |
| 8 | seguro contra terceros | seguro de responsabilidad civil (salvo legal) | [ ] Sí &nbsp; [ ] No, dice: _______ |
| 9 | 0 km | nueva de paquete, cero kilómetros | [ ] Sí &nbsp; [ ] No, dice: _______ |
| 10 | usada | de segunda mano, seminueva | [ ] Sí &nbsp; [ ] No, dice: _______ |
| 11 | cilindrada | cilindraje | [ ] Sí &nbsp; [ ] No, dice: _______ |
| 12 | casco | protección de cabeza | [ ] Sí &nbsp; [ ] No, dice: _______ |
| 13 | manejar | conducir | [ ] Sí &nbsp; [ ] No, dice: _______ |

## 2. Nombres de categoría (`DATABASE_SCHEMA.md` §2.5)

El documento normativo ya marca "Naked" y "Cub" como términos en inglés sin
validar. El resto de la lista también vale la pena repasar en voz alta con
un vendedor — son los nombres que van en un filtro, y un nombre raro en un
filtro "se nota inmediatamente y resta credibilidad" (`CONTENT_STRATEGY.md`
§1.2).

| # | Slug | Nombre candidato | ¿Es como lo llama el comercio? | Alternativa que use el comercio |
|---|---|---|---|---|
| 1 | `naked` | Naked | [ ] Sí &nbsp; [ ] No | _______ |
| 2 | `scooter` | Scooter | [ ] Sí &nbsp; [ ] No | _______ |
| 3 | `cub` | Cub | [ ] Sí &nbsp; [ ] No (¿"semiautomática"? ¿"underbone"? ¿un nombre local?) | _______ |
| 4 | `enduro-cross` | Enduro / Cross | [ ] Sí &nbsp; [ ] No | _______ |
| 5 | `touring` | Touring | [ ] Sí &nbsp; [ ] No | _______ |
| 6 | `deportiva` | Deportiva | [ ] Sí &nbsp; [ ] No | _______ |
| 7 | `custom-chopper` | Custom / Chopper | [ ] Sí &nbsp; [ ] No | _______ |
| 8 | `motocarro-carga` | Motocarro de carga | [ ] Sí &nbsp; [ ] No | _______ |
| 9 | `electrica` | Eléctrica | [ ] Sí &nbsp; [ ] No | _______ |
| 10 | `cuatriciclo` | Cuatriciclo | [ ] Sí &nbsp; [ ] No | _______ |

**Evidencia de uso real encontrada en R0** (acceso 2026-09-22, vía resultados
de búsqueda; ver `catalog.md` §0 sobre la limitación de red):

- **Star** (fabricante paraguayo) organiza su catálogo en
  [star.com.py](https://www.star.com.py/) con estas categorías: **Cobrador**,
  **Motoneta**, **Pistera**, **Todoterreno**, **Carga**. Es el único
  vocabulario de categorías de un actor paraguayo que se encontró, y no se
  parece al del esquema: ninguna de las cinco es "Naked" ni "Cub".
- En Clasipar, un vendedor tituló una Honda Wave (la `cub` típica) como
  "MOTO SCOOTER HONDA WAVE 110cc - 0KM" (#2226605). Sugiere que el
  comprador paraguayo no distingue `cub` de `scooter`, o que llama a ambas
  "motoneta"/"scooter".

Preguntas concretas para la llamada, con esa evidencia a mano:

| # | Pregunta | Candidato local | Respuesta |
|---|---|---|---|
| a | ¿Cómo le dicen a una CG 110 / Boxer 150 / GL 150 (moto de calle, de trabajo)? | "cobradora" / "pistera" / "de calle" | _______ |
| b | ¿Cómo le dicen a una Wave / Blitz 110 (semiautomática, sin embrague)? | "motoneta" / "scooter" / "semiautomática" | _______ |
| c | ¿Distinguen scooter (automática, plataforma plana) de la anterior, o es todo "motoneta"? | — | _______ |
| d | ¿"Todoterreno" o "Enduro / Cross" para una XR 150L / XTZ 150? | "todoterreno" / "trail" | _______ |
| e | ¿"Carga" o "Motocarro de carga" para un motocarro? | "carga" / "motocarro" | _______ |

Si el comercio confirma el vocabulario de Star, cambiar el **nombre visible**
de la categoría es contenido (no escala); cambiar un **slug** ya publicado es
cambio de URL y **sí escala** (`PLAN.md` §4.3). Por eso conviene decidirlo
antes de que B1 publique `/motos/tipo/<slug>`.

## 3. Etiquetas de estado de documentación (G-4, `TRUST_AND_SAFETY.md` §2 #5)

`DATABASE_SCHEMA.md` §2.6 ya marca estas etiquetas `[VALIDAR con un
comercio]` explícitamente. Son las tres opciones del enum
`documentation_status`:

| # | Valor interno | Etiqueta candidata visible | ¿Se entiende así? |
|---|---|---|---|
| 1 | `al_dia` | "Papeles al día" | [ ] Sí &nbsp; [ ] No, dice: _______ |
| 2 | `transferencia_pendiente` | "Transferencia pendiente" | [ ] Sí &nbsp; [ ] No, dice: _______ |
| 3 | `no_declara` | (el comercio prefiere no declarar el estado) — `[VERIFICAR: cómo mostrar esto sin sonar acusatorio ni ocultar información al comprador]` | [ ] Sí &nbsp; [ ] No, dice: _______ |

## 4. Cómo usar esto en la llamada

1. Leer cada término en voz alta tal como aparecería en un botón o filtro del
   sitio, sin explicarlo primero — para ver si el comercio lo entiende solo.
2. Anotar la palabra exacta que el comercio usa cuando no coincide, no una
   paráfrasis.
3. Guardar las respuestas en este mismo archivo (agregar una sección "Llamada
   con <comercio>, <fecha>" al final) — no se descarta nada, se agrega.
4. Cualquier cambio de etiqueta que resulte de esto es contenido, no
   esquema — no requiere escalar salvo que cambie el valor interno de un
   enum (eso sí requiere escalar, `DATABASE_SCHEMA.md` es normativo).
