import { useState, useEffect, useRef } from 'react';
import { X, Search } from 'lucide-react';
import type { FeatureCatalog } from '../lib/admin-api';

interface FeatureModalProps {
  isOpen: boolean;
  onConfirm: (code: string, value: string) => void;
  onCancel: () => void;
  existingFeature?: { code: string; value: string };
  adminApi: any;
}

export function FeatureModal({
  isOpen,
  onConfirm,
  onCancel,
  existingFeature,
  adminApi,
}: FeatureModalProps) {
  const [search, setSearch] = useState('');
  const [selectedFeature, setSelectedFeature] = useState<FeatureCatalog | null>(null);
  const [value, setValue] = useState<string>('');
  const [catalog, setCatalog] = useState<FeatureCatalog[]>([]);
  const [filteredCatalog, setFilteredCatalog] = useState<FeatureCatalog[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadCatalog();
      if (existingFeature) {
        const feature = catalog.find(f => f.code === existingFeature.code);
        if (feature) {
          setSelectedFeature(feature);
          setSearch(feature.name);
        }
        setValue(existingFeature.value);
      } else {
        setSelectedFeature(null);
        setSearch('');
        setValue('');
      }
    }
  }, [isOpen, existingFeature]);

  useEffect(() => {
    if (isOpen && searchInputRef.current && !existingFeature) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen, existingFeature]);

  useEffect(() => {
    if (search) {
      const filtered = catalog.filter(
        (f) =>
          f.name.toLowerCase().includes(search.toLowerCase()) ||
          f.code.toLowerCase().includes(search.toLowerCase()) ||
          f.description.toLowerCase().includes(search.toLowerCase())
      );
      setFilteredCatalog(filtered);
      setShowDropdown(true);
    } else {
      setFilteredCatalog(catalog);
      setShowDropdown(false);
    }
  }, [search, catalog]);

  const loadCatalog = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getFeatureCatalog();
      setCatalog(data);
      setFilteredCatalog(data);
    } catch (error) {
      console.error('Error loading feature catalog:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFeature && value.trim()) {
      onConfirm(selectedFeature.code, value.trim());
      handleReset();
    }
  };

  const handleSelectFeature = (feature: FeatureCatalog) => {
    setSelectedFeature(feature);
    setSearch(feature.name);
    setValue(feature.default_value || '');
    setShowDropdown(false);
  };

  const handleReset = () => {
    setSearch('');
    setSelectedFeature(null);
    setValue('');
    setShowDropdown(false);
  };

  const handleCancel = () => {
    handleReset();
    onCancel();
  };

  const getValueInput = () => {
    if (!selectedFeature) return null;

    switch (selectedFeature.value_type) {
      case 'boolean':
        return (
          <select
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="true">Habilitado</option>
            <option value="false">Deshabilitado</option>
          </select>
        );
      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            min="0"
            placeholder="0"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        );
      case 'text':
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Ingrese un valor"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        );
    }
  };

  const getValueHelperText = () => {
    if (!selectedFeature) return null;

    switch (selectedFeature.value_type) {
      case 'boolean':
        return 'Habilitar o deshabilitar esta funcionalidad';
      case 'number':
        return selectedFeature.unit
          ? `Cantidad máxima en ${selectedFeature.unit} (0 = ilimitado)`
          : 'Cantidad máxima permitida (0 = ilimitado)';
      case 'text':
        return 'Ingrese un valor de texto para esta funcionalidad';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
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
            Selecciona una funcionalidad del catálogo y configura su valor
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Buscar Funcionalidad
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setShowDropdown(true)}
                placeholder="Buscar por nombre, código o descripción..."
                disabled={!!existingFeature || loading}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>

            {showDropdown && filteredCatalog.length > 0 && (
              <div className="absolute z-10 w-full mt-2 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                {filteredCatalog.map((feature) => (
                  <button
                    key={feature.id}
                    type="button"
                    onClick={() => handleSelectFeature(feature)}
                    className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">{feature.name}</span>
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-mono">
                            {feature.code}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">{feature.description}</p>
                      </div>
                      <span className="ml-3 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium whitespace-nowrap">
                        {feature.category}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedFeature && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-blue-900">{selectedFeature.name}</h4>
                      <span className="px-2 py-0.5 bg-blue-200 text-blue-800 rounded text-xs font-mono">
                        {selectedFeature.code}
                      </span>
                    </div>
                    <p className="text-sm text-blue-800">{selectedFeature.description}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-blue-700">
                        <strong>Tipo:</strong> {selectedFeature.value_type}
                      </span>
                      {selectedFeature.unit && (
                        <span className="text-xs text-blue-700">
                          <strong>Unidad:</strong> {selectedFeature.unit}
                        </span>
                      )}
                      <span className="text-xs text-blue-700">
                        <strong>Categoría:</strong> {selectedFeature.category}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Valor / Límite
                </label>
                {getValueInput()}
                <p className="mt-1 text-xs text-gray-500">{getValueHelperText()}</p>
              </div>
            </>
          )}

          {!selectedFeature && !loading && (
            <div className="text-center py-8 text-gray-500">
              <Search className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">
                Busca y selecciona una funcionalidad del catálogo para continuar
              </p>
            </div>
          )}

          {loading && (
            <div className="text-center py-8 text-gray-500">
              <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
              <p className="text-sm mt-3">Cargando catálogo...</p>
            </div>
          )}
        </form>

        <div className="flex gap-3 p-6 border-t border-gray-200">
          <button
            type="button"
            onClick={handleCancel}
            className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={!selectedFeature || !value.trim()}
            className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {existingFeature ? 'Actualizar' : 'Agregar'}
          </button>
        </div>
      </div>
    </div>
  );
}
