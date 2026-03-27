-- =============================================
-- TABLA: usuarios (autenticación y acceso)
-- =============================================
CREATE TABLE usuarios (
    id              SERIAL PRIMARY KEY,
    empleado_id     INTEGER REFERENCES empleados(id) ON DELETE SET NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    rol             VARCHAR(50)  NOT NULL DEFAULT 'operador'
                    CHECK (rol IN ('superadmin', 'admin', 'rrhh', 'liquidador', 'operador')),
    activo          BOOLEAN      NOT NULL DEFAULT TRUE,
    ultimo_login    TIMESTAMP,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_usuarios_email      ON usuarios(email);
CREATE INDEX idx_usuarios_empleado   ON usuarios(empleado_id);
CREATE INDEX idx_usuarios_rol        ON usuarios(rol);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_usuarios_updated_at
    BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();