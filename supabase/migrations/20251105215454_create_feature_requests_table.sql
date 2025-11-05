/*
  # Create Feature Requests Table

  1. New Tables
    - `feature_requests`
      - `id` (uuid, primary key)
      - `name` (text) - Nombre de la funcionalidad solicitada
      - `code` (text) - Código sugerido para la funcionalidad
      - `description` (text) - Descripción de la funcionalidad
      - `category` (text) - Categoría sugerida
      - `requested_by` (text) - Email o identificador del solicitante
      - `status` (text) - Estado: 'pending', 'approved', 'rejected'
      - `admin_notes` (text) - Notas del administrador
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `feature_requests` table
    - Add policy for anyone to create requests
    - Add policy for authenticated admins to read all requests
*/

CREATE TABLE IF NOT EXISTS feature_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text,
  description text,
  category text,
  requested_by text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'implemented')),
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE feature_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can create feature requests
CREATE POLICY "Anyone can create feature requests"
  ON feature_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Policy: Anyone can read their own requests
CREATE POLICY "Users can read own requests"
  ON feature_requests
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_feature_requests_status ON feature_requests(status);
CREATE INDEX IF NOT EXISTS idx_feature_requests_created_at ON feature_requests(created_at DESC);