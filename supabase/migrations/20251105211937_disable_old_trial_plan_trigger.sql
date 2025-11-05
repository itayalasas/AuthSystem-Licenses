/*
  # Deshabilitar trigger viejo de asignación de plan de prueba

  ## Descripción
  El trigger `trigger_assign_trial_plan` es una versión antigua que crea
  tenants sin los campos requeridos `owner_email` y `billing_email`.
  
  Este trigger fue reemplazado por `trigger_auto_assign_trial_license`
  que sí incluye todos los campos necesarios.

  ## Cambios
  1. Elimina el trigger viejo `trigger_assign_trial_plan`
  2. Mantiene solo el trigger nuevo `trigger_auto_assign_trial_license`

  ## Notas
  - La función `assign_trial_plan_to_new_user()` no se elimina por si acaso
    se necesita en el futuro, pero el trigger que la invoca sí se elimina
*/

-- Eliminar el trigger viejo
DROP TRIGGER IF EXISTS trigger_assign_trial_plan ON application_users;

-- Comentario para documentación
COMMENT ON FUNCTION auto_assign_trial_license() IS 
  'Función activa para asignar automáticamente licencias de prueba a nuevos usuarios. Reemplaza a assign_trial_plan_to_new_user().';

COMMENT ON FUNCTION assign_trial_plan_to_new_user() IS 
  'DEPRECATED: Función deshabilitada. Usar auto_assign_trial_license() en su lugar.';
