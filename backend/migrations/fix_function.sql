DROP FUNCTION IF EXISTS find_or_create_user_by_identity;

CREATE OR REPLACE FUNCTION find_or_create_user_by_identity(
    identity_type_param VARCHAR(20),
    identity_value_param VARCHAR(255)
) 
RETURNS TABLE(user_id INTEGER, is_new BOOLEAN) 
AS $$
DECLARE
    existing_user_id INTEGER;
    new_user_id INTEGER;
BEGIN
    SELECT ui.user_id INTO existing_user_id
    FROM user_identities ui
    WHERE ui.identity_type = identity_type_param 
      AND ui.identity_value = identity_value_param;
    
    IF existing_user_id IS NOT NULL THEN
        RETURN QUERY SELECT existing_user_id::INTEGER, FALSE::BOOLEAN;
        RETURN;
    END IF;
    
    INSERT INTO users (created_at) 
    VALUES (NOW()) 
    RETURNING id INTO new_user_id;
    
    INSERT INTO user_identities (user_id, identity_type, identity_value, created_at, verified)
    VALUES (new_user_id, identity_type_param, identity_value_param, NOW(), TRUE);
    
    RETURN QUERY SELECT new_user_id::INTEGER, TRUE::BOOLEAN;
END;
$$ LANGUAGE plpgsql;