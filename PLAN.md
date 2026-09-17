/plan 
Eres un Arquitecto de Software Autónomo y un Enjambre de Agentes de Desarrollo. Tu objetivo es construir de inicio a fin la aplicación "ELI" (un tutor escolar basado en IA para niños de 6º de primaria).

Debes trabajar de forma autónoma. Para maximizar la eficiencia, divide tu razonamiento y ejecución como si fueras múltiples sub-agentes concurrentes trabajando en paralelo:
- Agente Frontend: UI/UX, Vercel config.
- Agente Backend: Node.js, Integración de APIs, OpenRouter.
- Agente Data/Ops: Supabase, Neon, Upstash.

ESTADO FINAL DESEADO:
Una aplicación web completa, lista para ser desplegada en Vercel bajo el dominio `https://eli.ngo`.

STACK TECNOLÓGICO:
- Backend/Frontend: Framework ligero basado en Node.js (Next.js App Router recomendado para compatibilidad nativa con Vercel).
- Base de Datos Relacional: Neon (PostgreSQL) para datos transaccionales.
- Autenticación y Storage: Supabase.
- Caché, Mensajería y Colas: Upstash (Redis).
- IA Core: ChatGPT Fable 5.1 para la demo inicial, pero abstraído mediante OpenRouter para facilitar el intercambio futuro de modelos.

INSTRUCCIONES DE DISEÑO DE IA (EL CORE DE ELI):
Debes crear un módulo de configuración de IA que inyecte este System Prompt exacto para el tutor:
"Eres 'ELI' (Tutor Nexo), un mentor de estudio inteligente, divertido y empático para estudiantes de 6º de primaria (11-12 años). Tu objetivo es prepararlos para la secundaria. REGLAS: 1. TONO: Claro, dinámico, sin tecnicismos complejos. 2. REGLA DE ORO: NUNCA des el resultado, ni redactes textos completos. Guía paso a paso (método socrático). 3. MATEMÁTICAS: Desglosa problemas, pide identificar datos primero. 4. ESPAÑOL/CIENCIAS: Usa analogías del siglo XXI (videojuegos, vida cotidiana). Haz preguntas de 'trivia rápida'. 5. CORRECCIÓN POSITIVA: Nunca digas 'No'. Di 'Buen intento, revisemos el paso anterior'. 6. FORMATO: Párrafos de max 3 líneas, uso de negritas y viñetas."

OPTIMIZACIÓN DE TOKENS EN FABLE:
Implementa una estrategia estricta de manejo de contexto para minimizar costos y latencia:
1. System Prompt Caching (si la API lo soporta) o inyección eficiente.
2. Sliding Window (Ventana deslizante): Conserva solo los últimos N mensajes (ej. 6 pares de Q&A) en el payload enviado al LLM.
3. Almacena el historial completo de la sesión de forma asíncrona en Neon DB usando colas de Upstash.

PLAN DE EJECUCIÓN PASO A PASO:
Ejecuta las siguientes fases secuencialmente, pero paraleliza la creación de archivos internos:

Fase 1: Inicialización del Proyecto (Agente Frontend & Backend)
- Crea la estructura del proyecto Node.js/Next.js.
- Configura `vercel.json` para el dominio eli.ngo.
- Configura las variables de entorno (`.env.example`) para Supabase, Neon, Upstash y OpenRouter.

Fase 2: Capa de Datos y Estado (Agente Data/Ops)
- Configura el cliente de Supabase (Autenticación de usuarios/padres).
- Configura la conexión a Neon (Tablas: `users`, `chat_sessions`, `messages`). Escribe los scripts SQL de migración.
- Configura el cliente de Upstash Redis (Implementa rate limiting para evitar spam y una cola para guardar mensajes en Neon en background).

Fase 3: Integración de IA (Agente Backend)
- Crea el servicio `ai.service.ts` o `.js`.
- Configura la conexión a OpenRouter (como proxy para ChatGPT Fable 5.1).
- Implementa la lógica de "Sliding Window" para la optimización de tokens en el historial.

Fase 4: Interfaz de Usuario (Agente Frontend)
- Crea una UI estilo chat simple, amigable para niños (burbujas de chat, tipografía legible, colores cálidos).
- Implementa un input donde la niña pueda escribir "Tengo este problema: [problema], me trabé en X".

Por favor, comienza analizando este plan y ejecutando la Fase 1. Pídeme que ejecute comandos de terminal (como `npm install`) si necesitas mi autorización, de lo contrario, procede creando los archivos.
