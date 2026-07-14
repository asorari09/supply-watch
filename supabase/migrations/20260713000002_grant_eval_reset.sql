grant execute on function eval.reset_all() to service_role;

notify pgrst, 'reload schema';
