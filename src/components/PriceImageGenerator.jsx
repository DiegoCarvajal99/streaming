import { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { X, Download, ImageIcon, ShieldCheck, Zap, Lock, Calendar } from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/es';

dayjs.locale('es');

export default function PriceImageGenerator({ isOpen, onClose, platforms }) {
  const [selectedType, setSelectedType] = useState('Final');
  const [isGenerating, setIsGenerating] = useState(false);
  const catalogRef = useRef(null);
  const [previewScale, setPreviewScale] = useState(0.7);

  const filteredPlatforms = platforms.filter(p => 
    p.activa !== false && (selectedType === 'Final' ? p.tipo === 'Final' : p.tipo === 'Distribuidor')
  );

  useEffect(() => {
    if (isOpen) {
      const updateScale = () => {
        const container = document.getElementById('canvas-area');
        if (container) {
          const padding = 60;
          const availableWidth = container.offsetWidth - padding;
          const availableHeight = container.offsetHeight - padding;
          
          const targetW = 800;
          const targetH = catalogRef.current ? catalogRef.current.offsetHeight : 1100;
          
          const scaleW = availableWidth / targetW;
          const scaleH = availableHeight / targetH;
          
          const finalScale = Math.min(scaleW, scaleH, 0.75);
          setPreviewScale(Math.max(finalScale, 0.4)); 
        }
      };
      const timer = setTimeout(updateScale, 100);
      window.addEventListener('resize', updateScale);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', updateScale);
      };
    }
  }, [isOpen, filteredPlatforms.length, selectedType]);

  if (!isOpen) return null;

  const handleDownload = async () => {
    if (!catalogRef.current) return;
    setIsGenerating(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 400));
      
      const canvas = await html2canvas(catalogRef.current, {
        useCORS: true,
        scale: 2, 
        backgroundColor: '#0a0f1d',
        logging: false,
        width: 800,
        height: catalogRef.current.scrollHeight, // Force full height
        onclone: (clonedDoc) => {
          const clonedElement = clonedDoc.querySelector('[data-ref-id="catalog-image"]');
          if (clonedElement) {
            // Remove transform and centering that might interfere
            clonedElement.style.transform = 'none';
            clonedElement.style.margin = '0';
            clonedElement.style.position = 'relative';
            clonedElement.style.top = '0';
            clonedElement.style.left = '0';
            
            // Ensure parents don't clip
            let parent = clonedElement.parentElement;
            while (parent) {
              parent.style.overflow = 'visible';
              parent.style.height = 'auto';
              parent.style.margin = '0';
              parent.style.padding = '0';
              parent = parent.parentElement;
            }
          }
        }
      });

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `Catalogo_Grupoxua_${selectedType === 'Final' ? 'Clientes' : 'Distribuidores'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Error generating image:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const formatPrice = (num) => {
    if (num === null || num === undefined) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 lg:p-4">
      <div className="fixed inset-0 bg-black/95 animate-in fade-in duration-500" onClick={onClose}></div>
      
      <div className="relative w-full max-w-7xl h-full lg:h-[92vh] bg-[#0a0f1d] lg:rounded-[32px] border border-white/5 shadow-3xl overflow-hidden flex flex-col lg:flex-row animate-in zoom-in-95 duration-500">
        
        {/* Sidebar */}
        <div className="w-full lg:w-72 bg-black/40 p-10 flex flex-col justify-between shrink-0 z-10 border-r border-white/5">
          <div className="space-y-12">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.4em] mb-2 text-white">Workspace</span>
              <h3 className="text-2xl font-black uppercase text-white tracking-tighter">Editor</h3>
            </div>

            <div className="space-y-8">
              <div className="space-y-4">
                <label className="text-[11px] font-black uppercase text-slate-500 tracking-[0.2em] ml-1">Segmento</label>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => setSelectedType('Final')}
                    className={`flex items-center gap-4 px-6 py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all ${
                      selectedType === 'Final' 
                        ? 'bg-indigo-600 text-white shadow-2xl shadow-indigo-600/20' 
                        : 'bg-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    <ShieldCheck size={18} />
                    Clientes
                  </button>
                  <button
                    onClick={() => setSelectedType('Distribuidor')}
                    className={`flex items-center gap-4 px-6 py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all ${
                      selectedType === 'Distribuidor' 
                        ? 'bg-indigo-600 text-white shadow-2xl shadow-indigo-600/20' 
                        : 'bg-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    <Zap size={18} />
                    Distribuidores
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-5 text-white">
            <button 
              onClick={handleDownload}
              disabled={isGenerating || filteredPlatforms.length === 0}
              className="w-full flex items-center justify-center gap-3 py-6 bg-white text-black hover:bg-slate-200 disabled:opacity-50 font-black rounded-2xl transition-all uppercase text-[11px] tracking-[0.2em] shadow-xl active:scale-95"
            >
              {isGenerating ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div> : <Download size={18} />}
              {isGenerating ? 'Generando...' : 'Descargar Imagen'}
            </button>
            <button onClick={onClose} className="w-full py-2 text-slate-500 hover:text-white font-black uppercase text-[10px] tracking-widest transition-colors text-center">Cerrar</button>
          </div>
        </div>

        {/* Canvas Area */}
        <div id="canvas-area" className="flex-1 bg-black/30 overflow-y-auto scrollbar-hide flex justify-center py-12 px-6">
          {filteredPlatforms.length > 0 ? (
            <div 
              ref={catalogRef}
              data-ref-id="catalog-image"
              style={{ 
                transform: `scale(${previewScale})`,
                transformOrigin: 'top center',
                width: '800px',
              }}
              className="bg-[#0a0f1d] pt-16 px-16 pb-24 flex flex-col gap-12 rounded-[4px] relative shrink-0 shadow-2xl border border-white/5 mb-20"
            >
              {/* Header */}
              <div className="flex flex-col items-center text-center space-y-10 relative">
                <div className="space-y-8 text-white">
                  <h1 className="text-7xl font-black italic tracking-tighter uppercase text-white leading-none">
                    GRUPO<span className="text-indigo-500">XUA</span>
                  </h1>
                  <div className="space-y-6 flex flex-col items-center">
                    <p 
                      style={{ letterSpacing: '0.6em', textIndent: '0.6em' }}
                      className="text-indigo-400 font-black uppercase text-[13px] leading-none text-center opacity-80"
                    >
                      Lista de Precios
                    </p>
                    <p 
                      style={{ letterSpacing: '0.3em', textIndent: '0.3em' }}
                      className={`font-black uppercase text-[15px] text-center leading-none px-10 py-2 border-y border-white/5 ${
                        selectedType === 'Final' ? 'text-purple-400' : 'text-blue-400'
                      }`}
                    >
                      {selectedType === 'Final' ? 'Clientes Finales' : 'Distribuidores Autorizados'}
                    </p>
                    <p className="text-slate-500 font-bold uppercase text-[11px] tracking-[0.3em]">{dayjs().format('DD [DE] MMMM, YYYY')}</p>
                  </div>
                </div>
              </div>

              {/* Stabilized Grid */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-6 relative">
                {filteredPlatforms.map(p => (
                  <div key={p.id} className="bg-slate-900/30 rounded-[32px] border border-white/5 p-6 flex items-center justify-between transition-all overflow-hidden">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-12 h-12 shrink-0 bg-black/40 rounded-xl border border-white/5 overflow-hidden flex items-center justify-center">
                        <img 
                          src={p.imagenUrl} 
                          alt={p.nombre} 
                          className="w-8 h-8 object-contain"
                          crossOrigin="anonymous"
                        />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <h3 className="text-[14px] font-black text-white uppercase tracking-tight leading-tight whitespace-normal">{p.nombre}</h3>
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{p.vigenciaDias} DÍAS</span>
                      </div>
                    </div>
                    <div className="pl-4 border-l border-white/5 shrink-0">
                      <span className="text-2xl font-black text-emerald-400 tracking-tighter leading-none">${formatPrice(p.precioVenta)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="mt-8 flex flex-col items-center gap-4 relative border-t border-white/5 pt-10">
                <p className="text-slate-500 font-black uppercase text-[10px] tracking-[0.4em] mb-4 opacity-50">Cuentas Garantizadas</p>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-8 px-10 py-4 bg-white/5 rounded-full w-full max-w-[650px]">
                  <div className="flex items-center justify-end gap-3 text-white">
                    <Calendar size={14} className="text-indigo-400" />
                    <span className="text-[11px] font-black uppercase tracking-widest whitespace-nowrap leading-none">Soporte durante todo el servicio</span>
                  </div>
                  <div className="w-1.5 h-1.5 bg-white/10 rounded-full"></div>
                  <div className="flex items-center justify-start gap-3 text-white">
                    <Zap size={14} className="text-indigo-400" />
                    <span className="text-[11px] font-black uppercase tracking-widest whitespace-nowrap leading-none">Entrega Inmediata</span>
                  </div>
                </div>
              </div>

              {/* Force bottom margin with invisible content */}
              <div className="h-20 w-full flex items-center justify-center">
                <div className="w-1 h-1 bg-[#0a0f1d]"></div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center space-y-10 my-auto text-white">
               <div className="w-32 h-32 bg-white/5 rounded-[48px] flex items-center justify-center text-slate-700 border border-white/5">
                  <ImageIcon size={64} />
               </div>
               <div className="space-y-4">
                  <h4 className="text-3xl font-black uppercase">Sin Plataformas</h4>
                  <p className="text-slate-500 font-bold text-sm uppercase tracking-widest max-w-[320px]">Agrega plataformas para visualizar el catálogo.</p>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
