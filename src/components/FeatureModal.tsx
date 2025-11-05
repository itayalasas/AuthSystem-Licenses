import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface FeatureModalProps {
  isOpen: boolean;
  onConfirm: (name: string, value: number) => void;
  onCancel: () => void;
  existingFeature?: { name: string; value: number };
}

export function FeatureModal({
  isOpen,
  onConfirm,
  onCancel,
  existingFeature,
}: FeatureModalProps) {
  const [name, setName] = useState('');
  const [value, setValue] = useState<number>(0);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (existingFeature) {
      setName(existingFeature.name);
      setValue(existingFeature.value);
    } else {
      setName('');
      setValue(0);
    }
  }, [existingFeature, isOpen]);

  useEffect(() => {
    if (isOpen && nameInputRef.current) {
      setTimeout(() => nameInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && value >= 0) {
      onConfirm(name.trim(), value);
      setName('');
      setValue(0);
    }
  };

  const handleCancel = () => {
    onCancel();
    setName('');
    setValue(0);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-900">
              {existingFeature ? 'Editar Funcionalidad' : 'Agregar Funcionalidad'}
            </h3>
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            Define el nombre y límite de la funcionalidad del plan
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre de la Funcionalidad
            </label>
            <input
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej: max_applications, max_projects, api_calls"
              disabled={!!existingFeature}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-gray-500">
              Usa snake_case para el nombre (ej: max_users, api_calls_per_month)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Límite / Valor
            </label>
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(parseInt(e.target.value) || 0)}
              min="0"
              placeholder="0"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500">
              Cantidad máxima permitida (0 = ilimitado o sin límite)
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-800">
              <strong>Ejemplos:</strong>
              <br />• max_users: 50 (máximo 50 usuarios)
              <br />• max_projects: 10 (hasta 10 proyectos)
              <br />• api_calls_per_day: 1000 (1000 llamadas diarias)
              <br />• storage_gb: 100 (100 GB de almacenamiento)
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!name.trim() || value < 0}
              className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {existingFeature ? 'Actualizar' : 'Agregar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
