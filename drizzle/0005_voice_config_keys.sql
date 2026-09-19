-- Datos (no esquema): `speech_model` se divide en `stt_model` y `tts_model` con otro significado.
-- Un `speech_model` guardado sería un modelo de chat (no vale como STT) y un `tts_model` guardado, un
-- nombre de modelo de Fish Audio directo (no vale en OpenRouter): se descartan y mandan los valores por
-- defecto/env hasta que un admin guarde otros desde /admin. Los valores gratuitos y de pago elegidos
-- están en lib/env.ts.
DELETE FROM "app_config" WHERE "key" IN ('speech_model', 'tts_model');
