CREATE TABLE empresas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social  text NOT NULL,
  nome          text NOT NULL,
  documento     text NOT NULL,
  segmento      text NOT NULL,
  cidade        text NOT NULL,
  logo_key      text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX empresas_documento_uq ON empresas (documento);

CREATE TABLE prestadores (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text NOT NULL,
  nascimento  date NOT NULL,
  documento   text NOT NULL,
  telefone    text NOT NULL,
  endereco    text NOT NULL,
  foto_key    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
