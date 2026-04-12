import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  PlusCircle, Search, Calendar, Filter, X, 
  Trash2, Edit3, RefreshCw, AlertCircle, Clock, ChevronDown, CheckCircle2,
  MessageCircle, ExternalLink, User, Phone, Copy, MoreHorizontal,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/es';

dayjs.locale('es');

export default function Sales() {
  const [sales, setSales] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSale, setEditingSale] = useState(null);
  
  const MESES_FULL = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

  const [filterYear, setFilterYear] = useState(dayjs().year().toString());
  const [filterMonth, setFilterMonth] = useState('Todos');
  const [filterType, setFilterType] = useState('Todos');
  const [filterStatus, setFilterStatus] = useState('Todos'); 
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  const [selectedSales, setSelectedSales] = useState([]);
  const [distribuidores, setDistribuidores] = useState([]);
  const [clients, setClients] = useState([]);
  const [clientSuggestions, setClientSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [openActionMenuId, setOpenActionMenuId] = useState(null);
  
  // Autocomplete Socios
  const [distSuggestions, setDistSuggestions] = useState([]);
  const [showDistSuggestions, setShowDistSuggestions] = useState(false);

  // Autocomplete Plataformas
  const [platSearchTerms, setPlatSearchTerms] = useState(['']); // Una por cada item
  const [activePlatIndex, setActivePlatIndex] = useState(null);
  
  const [formData, setFormData] = useState({
    cliente: '', 
    contacto: '', 
    items: [{ plataformaId: '', perfil: '', prevId: null, oldExpiry: null }], 
    tipoCliente: '', 
    fechaVenta: dayjs().format('YYYY-MM-DD')
  });

  const [editFormData, setEditFormData] = useState({
    cliente: '', contacto: '', perfil: '', tipoCliente: ''
  });

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false, type: null, data: null, title: '', message: '', icon: null, color: ''
  });

  const addItem = () => {
    setFormData(prev => ({ ...prev, items: [...prev.items, { plataformaId: '', perfil: '', prevId: null, oldExpiry: null }] }));
    setPlatSearchTerms(prev => [...prev, '']);
  };

  const removeItem = (index) => {
    if (formData.items.length <= 1) return;
    const newItems = [...formData.items];
    newItems.splice(index, 1);
    setFormData(prev => ({ ...prev, items: newItems }));
    
    const newTerms = [...platSearchTerms];
    newTerms.splice(index, 1);
    setPlatSearchTerms(newTerms);
  };

  const updateItem = (index, key, val) => {
    const newItems = [...formData.items];
    newItems[index][key] = val;
    setFormData(prev => ({ ...prev, items: newItems }));
  };

  const calculateTotals = () => {
    const parsePrice = (v) => Number(String(v).replace(/\./g, '')) || 0;
    let sumCompra = 0;
    let sumVenta = 0;
    let count = 0;

    formData.items.forEach(item => {
      const p = platforms.find(pl => pl.id === item.plataformaId);
      if (p) {
        sumCompra += parsePrice(p.precioCompra);
        sumVenta += parsePrice(p.precioVenta);
        count++;
      }
    });

    let discount = 0;
    if (count >= 2) {
      if (formData.tipoCliente === 'Distribuidor' || formData.tipoCliente === 'Otro') {
        if (sumCompra >= 10000) {
          if (count === 2) discount = 500;
          else if (count === 3) discount = 1000;
          else if (count >= 4) discount = 1500;
        }
      } else if (formData.tipoCliente === 'Final') {
        discount = count * 1000;
      }
    }

    const finalVenta = sumVenta - discount;
    // Según usuario: "a mi me hacen un descuento... y yo al distribuidor tambien le descuento lo mismo"
    // Esto implica que el costo para el administrador también baja en el caso de Distribuidor.
    const finalCompra = (formData.tipoCliente === 'Distribuidor' && sumCompra >= 10000) ? (sumCompra - discount) : sumCompra;

    return {
      sumCompra, sumVenta, discount,
      finalVenta, finalCompra,
      totalGanancia: finalVenta - finalCompra,
      count
    };
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const sSnap = await getDocs(collection(db, 'ventas'));
      const pSnap = await getDocs(collection(db, 'plataformas'));
      
      const salesData = sSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Ordenar por fechaCompra descendente (más recientes arriba)
      salesData.sort((a, b) => dayjs(b.fechaCompra).diff(dayjs(a.fechaCompra)));
      
      
      setSales(salesData);
      setPlatforms(pSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      
      const dSnap = await getDocs(collection(db, 'distribuidores'));
      setDistribuidores(dSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(d => d.activo));

      const cSnap = await getDocs(collection(db, 'clientes'));
      setClients(cSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  // Lógica de Recordatorio Sr WhatsApp
  const handleWhatsAppReminder = (sale) => {
    const cleanPhone = sale.contacto.replace(/\D/g, '');
    let platformLabel = sale.plataformaNombre;

    // Lógica para combos: si tiene comboId, buscar otros servicios activos del mismo combo
    if (sale.comboId) {
      const activeComboItems = sales.filter(s => s.comboId === sale.comboId && s.estado === 'Activo');
      if (activeComboItems.length > 1) {
        platformLabel = `combo de ${activeComboItems.map(s => s.plataformaNombre).join(', ')}`;
      }
    }

    const expiryDate = dayjs(sale.fechaVencimiento);
    const today = dayjs().startOf('day');
    const diffDays = expiryDate.startOf('day').diff(today, 'day');

    let message = '';
    
    if (diffDays > 0) {
      const formattedDate = expiryDate.format('D [de] MMMM [del] YYYY');
      message = `Hola, espero que se encuentre muy bien. Le escribo para recordarle que su ${platformLabel} vence el ${formattedDate}. Aún cuenta con ${diffDays} ${diffDays === 1 ? 'día' : 'días'} de servicio, ¿le gustaría realizar la renovación de una vez para que no se quede sin acceso?`;
    } else {
      message = `Hola, espero que se encuentre muy bien. Le escribo para informarle que su ${platformLabel} vence el día de hoy. ¿Le gustaría realizar la renovación de su cuenta para que no pierda el acceso al contenido?`;
    }
    
    // Si el contacto empieza por http, asumimos que es un link de grupo
    if (sale.contacto?.startsWith('http')) {
      window.open(`${sale.contacto}?text=${encodeURIComponent(message)}`, '_blank');
    } else {
      const url = `https://wa.me/${cleanPhone.startsWith('57') ? cleanPhone : '57' + cleanPhone}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
    }
  };

  const handleOpenModal = () => {
    setFormData({ 
      cliente: '', 
      contacto: '', 
      items: [{ plataformaId: '', perfil: '', prevId: null, oldExpiry: null }], 
      tipoCliente: '', 
      fechaVenta: dayjs().format('YYYY-MM-DD') 
    });
    setPlatSearchTerms(['']);
    setIsModalOpen(true);
  };

  const handleOpenBulkRenovate = (manualIds = null) => {
    const targetIds = Array.isArray(manualIds) ? manualIds : selectedSales;
    const selected = sales.filter(s => targetIds.includes(s.id));
    if (selected.length === 0) return;
    
    setFormData({
      cliente: selected[0].cliente,
      contacto: selected[0].contacto,
      tipoCliente: selected[0].tipoCliente,
      fechaVenta: dayjs(selected[0].fechaVencimiento).format('YYYY-MM-DD'),
      items: selected.map(s => ({
        plataformaId: s.plataformaId,
        perfil: s.perfil,
        prevId: s.id,
        oldExpiry: s.fechaVencimiento
      }))
    });
    setPlatSearchTerms(selected.map(s => s.plataformaNombre));
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (sale) => {
    setEditingSale(sale);
    setEditFormData({
      cliente: sale.cliente, 
      contacto: sale.contacto, 
      perfil: sale.perfil, 
      tipoCliente: sale.tipoCliente,
      fechaCompra: dayjs(sale.fechaCompra).format('YYYY-MM-DD'),
      plataformaId: sale.plataformaId
    });
    setIsEditModalOpen(true);
  };

  const showConfirm = (type, data) => {
    let config = {};
    if (type === 'delete') {
      config = {
        title: '¿Seguro quieres eliminar esta venta?',
        message: `Esta acción es permanente. Vas a eliminar el registro de ${data.cliente}.`,
        icon: <Trash2 size={40} className="text-red-500" />,
        color: 'red'
      };
    }
    setConfirmModal({ isOpen: true, type, data, ...config });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { count, discount } = calculateTotals();
    if (count === 0 || !formData.tipoCliente) return;

    setLoading(true);
    try {
      const comboId = `combo-${Date.now()}`;
      const base = dayjs(formData.fechaVenta);
      const discountPerItem = count > 0 ? (discount / count) : 0;

      const savePromises = formData.items.map(async (item) => {
        const platform = platforms.find(p => p.id === item.plataformaId);
        if (!platform) return;

        const parsePrice = (val) => Number(String(val).replace(/\./g, '')) || 0;
        const vtaBase = parsePrice(platform.precioVenta);
        const cpraBase = parsePrice(platform.precioCompra);

        // Calcular ganancia neta para este item prorrateando el descuento
        // Si es distribuidor, el descuento baja el precio de venta Y el costo
        // Si es final, baja el precio de venta pero el costo sigue igual.
        let vtaFinal = vtaBase;
        let cpraFinal = cpraBase;

        if (formData.tipoCliente === 'Final') {
          vtaFinal = count >= 2 ? (vtaBase - 1000) : vtaBase;
        } else {
          vtaFinal = vtaBase - discountPerItem;
          const { sumCompra } = calculateTotals();
          if (sumCompra >= 10000) cpraFinal = cpraBase - discountPerItem;
        }

        // Lógica de fecha encadenada para renovaciones
        const now = dayjs();
        const start = item.oldExpiry ? dayjs(item.oldExpiry) : base;
        const actualStart = (item.oldExpiry && start.isBefore(now)) ? now : start;
        const finalExpiry = actualStart.add(platform.vigenciaDias, 'day');

        const newSale = {
          cliente: formData.cliente,
          contacto: formData.contacto,
          plataformaId: platform.id,
          plataformaNombre: platform.nombre,
          plataformaImagenUrl: platform.imagenUrl || '',
          perfil: item.perfil,
          tipoCliente: formData.tipoCliente,
          fechaCompra: base.toISOString(),          // ← usa la fecha del formulario
          fechaVencimiento: finalExpiry.toISOString(),
          ganancia: vtaFinal - cpraFinal,
          mesRegistro: finalExpiry.format('MMMM YYYY'),
          estado: 'Activo',
          comboId: count > 1 ? comboId : null
        };

        if (item.prevId) {
          await updateDoc(doc(db, 'ventas', item.prevId), { estado: 'Renovado' });
        }

        return addDoc(collection(db, 'ventas'), newSale);
      });

      await Promise.all(savePromises);

      // Registrar cliente si es nuevo (solo para tipo Final)
      if (formData.tipoCliente === 'Final' && formData.cliente.trim()) {
        const clientExists = clients.some(c => c.nombre?.toLowerCase() === formData.cliente.toLowerCase());
        if (!clientExists) {
          await addDoc(collection(db, 'clientes'), {
            nombre: formData.cliente,
            contacto: formData.contacto,
            fechaRegistro: new Date().toISOString()
          });
        }
      }

      setIsModalOpen(false);
      setSelectedSales([]);
      fetchData();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSale = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const platform = platforms.find(p => p.id === editFormData.plataformaId);
      const vigencia = platform ? (Number(platform.vigenciaDias) || 30) : 30;
      
      const newStart = dayjs(editFormData.fechaCompra);
      const newExpiry = newStart.add(vigencia, 'day');
      
      await updateDoc(doc(db, 'ventas', editingSale.id), {
        cliente: editFormData.cliente, 
        contacto: editFormData.contacto, 
        perfil: editFormData.perfil, 
        tipoCliente: editFormData.tipoCliente,
        fechaCompra: newStart.toISOString(),
        fechaVencimiento: newExpiry.toISOString(),
        mesRegistro: newExpiry.format('MMMM YYYY')
      });
      setIsEditModalOpen(false);
      fetchData();
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const handleConfirmedAction = async () => {
    const { type, data } = confirmModal;
    setLoading(true);
    try {
      if (type === 'delete') {
        await deleteDoc(doc(db, 'ventas', data.id));
      }
      fetchData();
      setConfirmModal({...confirmModal, isOpen: false});
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  // MIGRACIÓN ÚNICA: recalcula fechaCompra = fechaVencimiento - vigenciaDias
  const [migrating, setMigrating] = useState(false);
  const [migrateResult, setMigrateResult] = useState(null);
  const migrateFechaCompra = async () => {
    setMigrating(true);
    setMigrateResult(null);
    let ok = 0, skip = 0;
    try {
      for (const venta of sales) {
        const platform = platforms.find(p => p.id === venta.plataformaId);
        if (!platform) { skip++; continue; }
        const vigenciaDias = Number(platform.vigenciaDias) || 30;
        const fechaVenc = venta.fechaVencimiento?.seconds
          ? dayjs(new Date(venta.fechaVencimiento.seconds * 1000))
          : dayjs(venta.fechaVencimiento);
        if (!fechaVenc.isValid()) { skip++; continue; }
        const nuevaFechaCompra = fechaVenc.subtract(vigenciaDias, 'day').toISOString();
        await updateDoc(doc(db, 'ventas', venta.id), { fechaCompra: nuevaFechaCompra });
        ok++;
      }
      setMigrateResult({ ok, skip, error: null });
      fetchData();
    } catch (err) {
      console.error(err);
      setMigrateResult({ ok, skip, error: err.message });
    } finally {
      setMigrating(false);
    }
  };

  const yearOptions = [...new Set(sales.map(s => dayjs(s.fechaCompra).year().toString()))]
    .filter(y => y > '2020')
    .sort((a, b) => b - a);
  // Asegurar que el año actual siempre esté
  if (!yearOptions.includes(dayjs().year().toString())) yearOptions.unshift(dayjs().year().toString());

  // Meses disponibles: todos desde Enero hasta el mes actual (si es el año en curso)
  // o los 12 meses completos (si es un año anterior)
  const availableMonths = parseInt(filterYear) === dayjs().year()
    ? MESES_FULL.slice(0, dayjs().month() + 1)  // Enero hasta mes actual
    : MESES_FULL;                                 // 12 meses para años anteriores

  const filteredSales = sales.filter(s => {
    const d = dayjs(s.fechaCompra);
    const matchesYear = d.year().toString() === filterYear;
    const matchesMonth = filterMonth === 'Todos' || d.month() === MESES_FULL.indexOf(filterMonth);
    const matchesType = filterType === 'Todos' || s.tipoCliente === filterType;
    const matchesStatus = filterStatus === 'Todos' || (s.estado || 'Activo') === filterStatus;
    const matchesSearch = 
      s.cliente.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (s.perfil && s.perfil.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesYear && matchesMonth && matchesType && matchesSearch && matchesStatus;
  });

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
    setFilterMonth('Todos'); // reset month when year changes
  }, [filterYear]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterMonth, filterType, filterStatus]);

  const totalPages = Math.ceil(filteredSales.length / itemsPerPage);
  const paginatedSales = filteredSales.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const PaginationControls = () => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between bg-slate-900/40 backdrop-blur-md p-4 rounded-3xl border border-slate-800/80 my-4 shadow-xl">
        <button 
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          disabled={currentPage === 1}
          className="flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 text-slate-300 font-black rounded-2xl transition-all active:scale-95 uppercase text-[9px] tracking-widest"
        >
          <ChevronLeft size={16} strokeWidth={3} /> Anterior
        </button>
        
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">Página {currentPage} de {totalPages}</span>
          <span className="text-[7px] font-bold text-slate-600 uppercase tracking-widest mt-0.5">{filteredSales.length} registros encontrados</span>
        </div>

        <button 
          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:hover:bg-indigo-600 text-white font-black rounded-2xl transition-all shadow-lg shadow-indigo-600/10 active:scale-95 uppercase text-[9px] tracking-widest"
        >
          Siguiente <ChevronRight size={16} strokeWidth={3} />
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-1000">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        <div className="space-y-1">
          <h2 className="text-5xl font-black tracking-tight text-white uppercase italic">Ventas</h2>
          <div className="flex items-center gap-2">
            <div className="w-12 h-1 bg-indigo-500 rounded-full"></div>
            <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Premium Dashboard v3.0</p>
          </div>
        </div>
        <button onClick={handleOpenModal} className="flex items-center gap-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black py-5 px-10 rounded-[30px] shadow-2xl shadow-indigo-500/20 transition-all active:scale-95 uppercase text-[11px] tracking-widest leading-none">
          <PlusCircle size={20} /> Registrar Venta
        </button>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-4 gap-4 sm:gap-6 bg-slate-900/40 p-5 sm:p-6 rounded-[32px] border border-slate-800 shadow-inner">
        {/* BUSCADOR */}
        <div className="relative group lg:col-span-1">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={20} />
          <input type="text" placeholder="BUSCAR CLIENTE..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-slate-800/50 border border-slate-700/50 rounded-2xl pl-12 pr-6 py-4 text-white text-[10px] uppercase font-black outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-600" />
        </div>

        {/* FILTROS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex gap-2 sm:gap-3 lg:col-span-3">
          {/* AÑO */}
          <div className="relative flex-1">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
            <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="w-full bg-slate-900 border border-slate-700/50 rounded-xl sm:rounded-2xl pl-8 pr-4 py-4 text-white text-[8px] sm:text-[10px] font-black uppercase appearance-none cursor-pointer">
              {yearOptions.map(y => <option key={y} value={y} className="bg-slate-900">{y}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>

          {/* MES */}
          <div className="relative flex-1">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
            <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="w-full bg-slate-900 border border-slate-700/50 rounded-xl sm:rounded-2xl pl-8 pr-4 py-4 text-white text-[8px] sm:text-[10px] font-black uppercase appearance-none cursor-pointer">
              <option value="Todos" className="bg-slate-900">TODOS</option>
              {availableMonths.map(m => <option key={m} value={m} className="bg-slate-900 capitalize">{m}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>

          {/* TIPO */}
          <div className="relative flex-1">
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-full bg-slate-900 border border-slate-700/50 rounded-xl sm:rounded-2xl pl-3 pr-4 py-4 text-white text-[8px] sm:text-[10px] font-black uppercase appearance-none cursor-pointer">
              <option value="Todos" className="bg-slate-900">Tipo</option>
              <option value="Final" className="bg-slate-900">Final</option>
              <option value="Distribuidor" className="bg-slate-900">Socio</option>
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>

          {/* ESTADO */}
          <div className="relative flex-1">
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full bg-slate-900 border border-slate-700/50 rounded-xl sm:rounded-2xl pl-3 pr-4 py-4 text-white text-[8px] sm:text-[10px] font-black uppercase appearance-none cursor-pointer">
              <option value="Todos" className="bg-slate-900">Estado</option>
              <option value="Activo" className="bg-slate-900">Activo</option>
              <option value="Renovado" className="bg-slate-900">Renovado</option>
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>
        </div>
      </div>

      <PaginationControls />

      {/* Accesorios Globales para Menús */}
      {openActionMenuId && (
        <div 
          className="fixed inset-0 z-[140] bg-transparent" 
          onClick={() => setOpenActionMenuId(null)}
        ></div>
      )}

      {/* DESKTOP TABLE VIEW */}
      <div className="hidden lg:block bg-slate-900/40 rounded-[40px] border border-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
        <div className="overflow-visible">
          <table className="w-full border-separate border-spacing-y-2">
            <thead>
              <tr className="bg-transparent">
                <th className="px-4 py-4 text-left">
                  <button onClick={() => {
                    if (selectedSales.length === filteredSales.length) setSelectedSales([]);
                    else setSelectedSales(filteredSales.map(s => s.id));
                  }} className={`p-2 rounded-lg border-2 transition-all ${selectedSales.length === filteredSales.length && filteredSales.length > 0 ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-slate-800 text-slate-800 hover:border-slate-700'}`}>
                    <CheckCircle2 size={14} />
                  </button>
                </th>
                <th className="px-4 py-5 text-left text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Cliente</th>
                <th className="px-4 py-5 text-center text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Servicio</th>
                <th className="px-4 py-5 text-left text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Perfil</th>
                <th className="px-4 py-5 text-left text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Inicio</th>
                <th className="px-4 py-5 text-left text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Corte</th>
                <th className="px-4 py-5 text-left text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Ganancia</th>
                <th className="px-4 py-5 text-left text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Estado</th>
                <th className="px-4 py-5 text-right text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="px-8">
              {paginatedSales.map((sale) => {
                const today = dayjs().format('YYYY-MM-DD');
                const expiryDate = dayjs(sale.fechaVencimiento).format('YYYY-MM-DD');
                const diffDays = dayjs(sale.fechaVencimiento).startOf('day').diff(dayjs().startOf('day'), 'day');
                const isExpired = diffDays < 0;
                const isToday = today === expiryDate;

                return (
                  <tr key={sale.id} className={`group ${selectedSales.includes(sale.id) ? 'bg-indigo-500/10 border-l-4 border-indigo-500' : 'bg-slate-900/60 hover:bg-slate-800 border-l-4 border-transparent hover:border-indigo-500/50'} transition-all duration-300 shadow-xl hover:shadow-indigo-500/10`}>
                    <td className="px-4 py-5 rounded-l-[20px]">
                      {sale.estado !== 'Renovado' && !isExpired && !!sale.comboId && (
                        <button onClick={() => {
                          setSelectedSales(prev => prev.includes(sale.id) ? prev.filter(id => id !== sale.id) : [...prev, sale.id]);
                        }} className={`p-2.5 rounded-xl border-2 transition-all ${selectedSales.includes(sale.id) ? 'bg-indigo-600 border-indigo-500 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]' : 'border-slate-800 text-slate-700 hover:border-slate-600'}`}>
                          <CheckCircle2 size={14} strokeWidth={3} />
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-5">
                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-500 group-hover:text-indigo-400 group-hover:border-indigo-500/30 transition-all duration-500 shadow-inner">
                          <User size={22} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[13px] font-black text-white group-hover:text-indigo-300 transition-colors uppercase tracking-tight leading-none italic">{sale.cliente}</span>
                          <span className={`w-max text-[8px] font-black uppercase px-3 py-1 rounded-lg border tracking-widest ${sale.tipoCliente === 'Distribuidor' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.1)]' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'}`}>{sale.tipoCliente === 'Distribuidor' ? 'SOCIO' : 'FINAL'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-5">
                      <div className="flex items-center justify-center">
                        <img src={sale.plataformaImagenUrl} alt="" className="w-12 h-12 object-contain drop-shadow-lg group-hover:scale-110 transition-transform duration-500" />
                      </div>
                    </td>
                    <td className="px-4 py-5">
                      <span className="font-black text-sm text-slate-300 uppercase tracking-tighter">{sale.perfil || 'N/A'}</span>
                    </td>
                    <td className="px-4 py-5">
                      <span className="text-[11px] font-black text-slate-300 uppercase tracking-tighter whitespace-nowrap">{dayjs(sale.fechaCompra).format('DD MMM YYYY')}</span>
                    </td>
                    <td className="px-4 py-5">
                      <div className="flex flex-col gap-1">
                        <span className="text-[11px] font-black text-white uppercase tracking-tighter">{dayjs(sale.fechaVencimiento).format('DD MMM YYYY')}</span>
                        {sale.estado !== 'Renovado' && (
                          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md w-max border ${isExpired ? 'bg-red-500/10 text-red-500 border-red-500/20' : isToday ? 'bg-orange-500/10 text-orange-400 border-orange-500/20 animate-pulse' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                             <Clock size={10} />
                             <span className="text-[9px] font-black uppercase">{isExpired ? 'Vencido' : isToday ? 'Vence hoy' : `${diffDays} días`}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-5">
                      <span className="text-emerald-400 font-black text-sm tracking-tighter">${(sale.ganancia || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}</span>
                    </td>
                    <td className="px-4 py-5">
                      <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full border ${
                        sale.estado === 'Renovado' ? 'bg-slate-500/10 text-slate-500 border-slate-500/20' : 
                        isExpired ? 'bg-slate-500/10 text-slate-500 border-slate-500/20' : 
                        'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}>
                        {sale.estado === 'Renovado' ? 'Renovado' : isExpired ? 'Vencido' : 'Activo'}
                      </span>
                    </td>
                    <td className="px-4 py-5 rounded-r-[20px]">
                       <div className="relative flex items-center justify-end">
                          <button
                            onClick={() => setOpenActionMenuId(openActionMenuId === sale.id ? null : sale.id)}
                            className={`p-2.5 rounded-xl transition-all ${openActionMenuId === sale.id ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}
                          >
                            <MoreHorizontal size={18} />
                          </button>

                          {openActionMenuId === sale.id && (
                            <div className="absolute right-0 top-[calc(100%+8px)] z-[150] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-2 min-w-[170px] animate-in fade-in zoom-in-95 duration-200 backdrop-blur-xl">
                              {sale.estado === 'Activo' && !isExpired ? (
                                <>
                                  <button onClick={() => { handleWhatsAppReminder(sale); setOpenActionMenuId(null); }} className="w-full flex items-center gap-3 p-3 hover:bg-emerald-500/10 text-emerald-500 rounded-xl transition-all">
                                    <MessageCircle size={16}/><span className="text-[10px] font-black uppercase tracking-widest">WhatsApp</span>
                                  </button>
                                  
                                  <button onClick={() => { handleOpenBulkRenovate([sale.id]); setOpenActionMenuId(null); }} className="w-full flex items-center gap-3 p-3 hover:bg-indigo-500/10 text-indigo-400 rounded-xl transition-all">
                                    <RefreshCw size={16}/><span className="text-[10px] font-black uppercase tracking-widest">Renovar</span>
                                  </button>

                                  <button 
                                    onClick={() => { 
                                      handleOpenEditModal(sale);
                                      setOpenActionMenuId(null); 
                                    }} 
                                    className="w-full flex items-center gap-3 p-3 hover:bg-slate-800 text-slate-400 rounded-xl transition-all"
                                  >
                                    <Edit3 size={16}/><span className="text-[10px] font-black uppercase tracking-widest">Editar</span>
                                  </button>

                                  <div className="my-1 border-t border-slate-800"></div>
                                </>
                              ) : null}

                              <button 
                                onClick={() => { 
                                  showConfirm('delete', sale); 
                                  setOpenActionMenuId(null); 
                                }} 
                                className="w-full flex items-center gap-3 p-3 hover:bg-red-500/10 text-red-500 rounded-xl transition-all"
                              >
                                <Trash2 size={16}/><span className="text-[10px] font-black uppercase tracking-widest">Eliminar</span>
                              </button>
                            </div>
                          )}
                       </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MOBILE RECORD CARDS VIEW (COMPACT SENIOR UI) */}
      <div className="lg:hidden space-y-2">
        {paginatedSales.map((sale) => {
          const today = dayjs().format('YYYY-MM-DD');
          const expiryDate = dayjs(sale.fechaVencimiento).format('YYYY-MM-DD');
          const diffDays = dayjs(sale.fechaVencimiento).startOf('day').diff(dayjs().startOf('day'), 'day');
          const isExpired = diffDays < 0;
          const isToday = today === expiryDate;

          return (
            <div key={sale.id} className={`group relative bg-slate-900/40 p-4 rounded-2xl border border-slate-800/60 transition-all active:scale-[0.98] ${selectedSales.includes(sale.id) ? 'border-indigo-500/50 bg-indigo-500/5' : ''}`}>
              <div className="flex items-center gap-4">
                {/* Selection Control - Mobile */}
                {sale.estado !== 'Renovado' && !isExpired && !!sale.comboId && (
                  <div className="shrink-0 flex items-center justify-center">
                    <button 
                      onClick={() => {
                        setSelectedSales(prev => prev.includes(sale.id) ? prev.filter(id => id !== sale.id) : [...prev, sale.id]);
                      }} 
                      className={`p-2 rounded-lg border-2 transition-all ${selectedSales.includes(sale.id) ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'border-slate-800 text-slate-800'}`}
                    >
                      <CheckCircle2 size={12} />
                    </button>
                  </div>
                )}

                {/* Platform Icon */}
                <div className="shrink-0">
                  <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 p-1.5 flex items-center justify-center overflow-hidden">
                    <img src={sale.plataformaImagenUrl} alt="" className="w-full h-full object-contain" />
                  </div>
                </div>

                {/* Primary Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs font-black text-white uppercase truncate tracking-tight">{sale.cliente}</h4>
                    <span className={`text-[7px] font-black uppercase px-2 py-0.5 rounded border ${sale.tipoCliente === 'Distribuidor' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'}`}>
                      {sale.tipoCliente === 'Distribuidor' ? 'SOCIO' : 'FINAL'}
                    </span>
                    <span className={`text-[7px] font-black uppercase px-2 py-0.5 rounded border ${
                      sale.estado === 'Renovado' ? 'bg-slate-500/10 text-slate-500 border-slate-500/20' : 
                      isExpired ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 
                      isToday ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    }`}>
                      {sale.estado === 'Renovado' ? 'RENOVADO' : isExpired ? 'VENCIDO' : isToday ? 'HOY' : 'ACTIVO'}
                    </span>
                  </div>
                  <p className="text-[9px] font-bold text-slate-500 truncate mt-1">PERFIL: <span className="text-slate-300">{sale.perfil || 'S/N'}</span></p>
                </div>

                {/* Metrics & Actions */}
                <div className="flex flex-col items-end gap-2 relative">
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-[10px] font-black text-white leading-none">{dayjs(sale.fechaVencimiento).format('DD MMM')}</p>
                      {sale.estado !== 'Renovado' && (
                        <p className={`text-[7px] font-black uppercase tracking-widest ${isExpired ? 'text-red-500' : 'text-slate-500'}`}>
                          {isExpired ? 'VENCIDO' : `${diffDays} DÍAS`}
                        </p>
                      )}
                    </div>
                    <div className="w-[1px] h-6 bg-slate-800"></div>
                    
                    <button 
                      onClick={() => setOpenActionMenuId(openActionMenuId === sale.id ? null : sale.id)}
                      className={`p-2.5 rounded-xl transition-all ${openActionMenuId === sale.id ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                    >
                      <MoreHorizontal size={18} />
                    </button>

                    {openActionMenuId === sale.id && (
                      <div className="absolute right-0 top-[calc(100%+8px)] z-[150] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-2 min-w-[160px] animate-in fade-in zoom-in-95 duration-200 backdrop-blur-xl">
                        {sale.estado === 'Activo' && !isExpired ? (
                          <>
                            <button onClick={() => { handleWhatsAppReminder(sale); setOpenActionMenuId(null); }} className="w-full flex items-center gap-3 p-3 hover:bg-emerald-500/10 text-emerald-500 rounded-xl transition-all">
                              <MessageCircle size={16}/><span className="text-[10px] font-black uppercase tracking-widest">WhatsApp</span>
                            </button>
                            <button onClick={() => { handleOpenBulkRenovate([sale.id]); setOpenActionMenuId(null); }} className="w-full flex items-center gap-3 p-3 hover:bg-indigo-500/10 text-indigo-400 rounded-xl transition-all">
                              <RefreshCw size={16}/><span className="text-[10px] font-black uppercase tracking-widest">Renovar</span>
                            </button>
                            <button 
                              onClick={() => {
                                setEditingSale(sale);
                                setEditFormData({
                                  id: sale.id, cliente: sale.cliente, contacto: sale.contacto,
                                  perfil: sale.perfil || '', tipoCliente: sale.tipoCliente || 'Final'
                                });
                                setIsEditModalOpen(true);
                                setOpenActionMenuId(null);
                              }}
                              className="w-full flex items-center gap-3 p-3 hover:bg-slate-800 text-slate-400 rounded-xl transition-all"
                            >
                              <Edit3 size={16}/><span className="text-[10px] font-black uppercase tracking-widest">Editar</span>
                            </button>
                            <div className="my-1 border-t border-slate-800"></div>
                          </>
                        ) : null}
                        
                        <button 
                          onClick={() => { showConfirm('delete', sale); setOpenActionMenuId(null); }}
                          className="w-full flex items-center gap-3 p-3 hover:bg-red-500/10 text-red-500 rounded-xl transition-all"
                        >
                          <Trash2 size={16}/><span className="text-[10px] font-black uppercase tracking-widest">Eliminar</span>
                        </button>
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] font-black text-emerald-400 tracking-tighter leading-none">${(sale.ganancia || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <PaginationControls />

          {filteredSales.length === 0 && (
            <div className="py-24 px-8 flex flex-col items-center justify-center text-center animate-in fade-in duration-500">
              {/* Icon */}
              <div className="relative mb-8">
                <div className="w-28 h-28 bg-gradient-to-br from-slate-800 to-slate-900 rounded-[36px] border border-slate-700/50 flex items-center justify-center shadow-2xl">
                  <AlertCircle size={48} className="text-slate-600" />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-indigo-600/20 rounded-full border border-indigo-500/30 flex items-center justify-center">
                  <span className="text-indigo-400 text-xs font-black">0</span>
                </div>
              </div>
              {/* Text */}
              <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-3">Sin Resultados</h3>
              <p className="text-slate-500 text-[11px] font-bold uppercase tracking-[0.2em] max-w-xs leading-relaxed mb-8">
                {searchTerm ? `No hay ventas que coincidan con "${searchTerm}"` : 'No hay ventas registradas para los filtros seleccionados'}
              </p>
              {/* Actions */}
              <div className="flex items-center gap-4">
                {(searchTerm || filterMonth !== 'Todos' || filterType !== 'Todos' || filterStatus !== 'Todos') && (
                  <button
                    onClick={() => { setSearchTerm(''); setFilterMonth('Todos'); setFilterType('Todos'); setFilterStatus('Todos'); }}
                    className="flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-black rounded-2xl transition-all text-[9px] uppercase tracking-widest"
                  >
                    <X size={14} /> Limpiar filtros
                  </button>
                )}
                <button
                  onClick={handleOpenModal}
                  className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl transition-all text-[9px] uppercase tracking-widest shadow-lg shadow-indigo-600/20"
                >
                  <PlusCircle size={14} /> Registrar Venta
                </button>
              </div>
            </div>
          )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md"></div>
          <div className="relative w-full max-w-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/20 rounded-[32px] border border-slate-800 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300 h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-7 py-5 border-b border-slate-800 shrink-0">
              <h3 className="text-xl font-black italic tracking-tighter uppercase text-white">Nueva Venta</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-slate-800 rounded-2xl transition-all"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="px-7 py-5 space-y-6 overflow-y-auto scrollbar-hide flex-1">
              {/* DATOS DEL CLIENTE */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-1 bg-indigo-500 rounded-full"></div>
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em]">Información del Cliente</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-[50]">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest leading-none">Segmento</label>
                    <div className="relative">
                      <select required value={formData.tipoCliente} onChange={e => setFormData({...formData, tipoCliente: e.target.value, cliente: '', contacto: ''})} className="w-full bg-slate-900 border border-slate-700/50 rounded-xl px-4 py-3 text-white font-black text-xs appearance-none cursor-pointer">
                        <option value="" disabled className="bg-slate-900">SELECCIONAR...</option>
                        <option value="Final" className="bg-slate-900">CLIENTE FINAL</option>
                        <option value="Distribuidor" className="bg-slate-900">DISTRIBUIDOR</option>
                      </select>
                      <ChevronDown size={20} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  {formData.tipoCliente === 'Distribuidor' ? (
                    <div className="space-y-3 relative">
                      <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest leading-none">Socio / Grupo</label>
                      <input 
                        required 
                        placeholder="Buscar socio..." 
                        value={formData.cliente} 
                        onChange={e => {
                          const val = e.target.value;
                          setFormData({...formData, cliente: val});
                          if (val.trim()) {
                            const filtered = distribuidores.filter(d => d.nombre?.toLowerCase().includes(val.toLowerCase()));
                            setDistSuggestions(filtered);
                            setShowDistSuggestions(true);
                          } else {
                            setShowDistSuggestions(false);
                          }
                        }} 
                        onBlur={() => setTimeout(() => setShowDistSuggestions(false), 200)}
                        className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white font-black text-xs outline-none focus:ring-2 focus:ring-indigo-500/20" 
                      />
                      {showDistSuggestions && distSuggestions.length > 0 && (
                        <div className="absolute z-[500] left-0 right-0 top-[100%] mt-2 bg-slate-950 border border-slate-800 rounded-2xl shadow-3xl overflow-hidden animate-in fade-in slide-in-from-top-2 backdrop-blur-xl ring-1 ring-white/5">
                          {distSuggestions.map((d, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => {
                                setFormData({...formData, cliente: d.nombre, contacto: d.whatsappLink || ''});
                                setShowDistSuggestions(false);
                              }}
                              className="w-full text-left px-6 py-4 hover:bg-slate-800 text-slate-300 hover:text-white font-bold text-xs transition-colors border-b border-slate-800 last:border-0 uppercase tracking-tighter"
                            >
                              <span>{d.nombre}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={`transition-all duration-500 ease-out ${formData.tipoCliente === 'Final' ? 'opacity-100 max-h-[500px] translate-x-0 overflow-visible' : 'opacity-0 max-h-0 -translate-x-4 pointer-events-none overflow-hidden'}`}>
                      <div className="space-y-3 relative">
                        <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest leading-none">Cliente</label>
                        <input 
                          required={formData.tipoCliente === 'Final'}
                          placeholder="Ej: Juan Pérez" 
                          value={formData.cliente} 
                          onChange={e => {
                            const val = e.target.value;
                            setFormData({...formData, cliente: val});
                            if (val.trim()) {
                              const filtered = clients.filter(c => c.nombre?.toLowerCase().includes(val.toLowerCase()));
                              setClientSuggestions(filtered);
                              setShowSuggestions(true);
                            } else {
                              setShowSuggestions(false);
                            }
                          }} 
                          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                          className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white font-black text-xs outline-none focus:ring-2 focus:ring-indigo-500/20" 
                        />
                        {showSuggestions && clientSuggestions.length > 0 && (
                          <div className="absolute z-[500] left-0 right-0 top-[100%] mt-2 bg-slate-950 border border-slate-800 rounded-2xl shadow-3xl overflow-hidden animate-in fade-in slide-in-from-top-2 backdrop-blur-xl ring-1 ring-white/5">
                            {clientSuggestions.map((c, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => {
                                  setFormData({...formData, cliente: c.nombre, contacto: c.contacto});
                                  setShowSuggestions(false);
                                }}
                                className="w-full text-left px-6 py-4 hover:bg-slate-800 text-slate-300 hover:text-white font-bold text-xs transition-colors border-b border-slate-800 last:border-0 uppercase tracking-tighter"
                              >
                                <div className="flex justify-between items-center">
                                  <span>{c.nombre}</span>
                                  <span className="text-[9px] text-slate-500">{c.contacto}</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className={`flex flex-col sm:flex-row ${formData.tipoCliente === 'Final' ? 'sm:gap-8' : 'sm:gap-0'} items-start transition-all duration-500 relative z-[40]`}>
                  <div className={`transition-all duration-500 ease-out overflow-hidden ${formData.tipoCliente === 'Final' ? 'w-full sm:w-1/2 opacity-100 translate-x-0' : 'w-0 h-0 opacity-0 -translate-x-10 pointer-events-none'}`}>
                    <div className="space-y-3 min-w-[200px]">
                      <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest leading-none">WhatsApp</label>
                      <input required={formData.tipoCliente === 'Final'} placeholder="+57 300 000 0000" value={formData.contacto} onChange={e => setFormData({...formData, contacto: e.target.value})} className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white font-black text-xs outline-none focus:ring-2 focus:ring-indigo-500/20" />
                    </div>
                  </div>
                  <div className={`w-full sm:w-1/2 space-y-3 transition-all duration-500 ease-out ${formData.tipoCliente !== 'Final' ? 'sm:-ml-0' : ''}`}>
                    <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest leading-none">Fecha de Inicio</label>
                    <div className="relative group cursor-pointer" onClick={(e) => e.currentTarget.querySelector('input').showPicker()}>
                      <div className="absolute inset-0 bg-indigo-500/5 group-hover:bg-indigo-500/10 rounded-2xl transition-all border border-slate-700/50 group-hover:border-indigo-500/50 group-hover:shadow-[0_0_20px_-5px_rgba(99,102,241,0.2)]"></div>
                      <div className="relative flex items-center px-4 py-3 gap-4">
                        <div className="flex flex-col items-center">
                          <span className="text-lg font-black text-indigo-400 leading-none">{dayjs(formData.fechaVenta).format('DD')}</span>
                          <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">{dayjs(formData.fechaVenta).format('MMM')}</span>
                        </div>
                        <div className="w-[1px] h-8 bg-slate-800"></div>
                        <div className="flex-1">
                          <h4 className="text-[10px] font-black text-white uppercase tracking-widest">{dayjs(formData.fechaVenta).format('dddd')}</h4>
                          <p className="text-[9px] font-bold text-slate-500 uppercase">{dayjs(formData.fechaVenta).format('MMMM [del] YYYY')}</p>
                        </div>
                        <Calendar size={20} className="text-slate-600 group-hover:text-indigo-400 transition-colors" />
                      </div>
                      <input 
                        required 
                        type="date" 
                        value={formData.fechaVenta} 
                        onChange={e => setFormData({...formData, fechaVenta: e.target.value})} 
                        className="absolute inset-0 opacity-0 cursor-pointer" 
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* CANASTA DE PLATAFORMAS */}
              <div className="space-y-6 relative z-[30]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-1 bg-emerald-500 rounded-full"></div>
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em]">Plataformas Solicitadas</h4>
                  </div>
                  {formData.items.length === 0 && (
                    <button type="button" onClick={addItem} className="flex items-center gap-2 text-[10px] font-black uppercase text-indigo-400 hover:text-indigo-300 transition-colors">
                      <PlusCircle size={16} /> Añadir Cuenta
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  {formData.items.map((item, idx) => (
                    <div key={idx} className="group relative bg-slate-950/40 p-4 rounded-2xl border border-slate-800/50 hover:border-indigo-500/30 transition-all">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-3 relative z-[10]">
                          <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Plataforma</label>
                          <input 
                            required 
                            placeholder="Buscar plataforma..." 
                            value={platSearchTerms[idx] || ''} 
                            onChange={e => {
                              const val = e.target.value;
                              const newTerms = [...platSearchTerms];
                              newTerms[idx] = val;
                              setPlatSearchTerms(newTerms);
                              setActivePlatIndex(idx);
                            }} 
                            onBlur={() => setTimeout(() => setActivePlatIndex(null), 200)}
                            className="w-full bg-slate-900 border border-slate-700/50 rounded-xl px-4 py-3 text-white font-black text-[11px] outline-none focus:ring-1 focus:ring-indigo-500/30" 
                          />
                          {activePlatIndex === idx && platSearchTerms[idx] && (
                            <div className="absolute z-[500] left-0 right-0 top-[100%] mt-2 bg-slate-950 border border-slate-800 rounded-2xl shadow-3xl overflow-hidden backdrop-blur-xl ring-1 ring-white/5">
                              {platforms
                                .filter(p => p.activa && p.tipo === formData.tipoCliente && p.nombre.toLowerCase().includes(platSearchTerms[idx].toLowerCase()))
                                .map((p, i) => (
                                  <button
                                    key={i}
                                    type="button"
                                    onClick={() => {
                                      updateItem(idx, 'plataformaId', p.id);
                                      const newTerms = [...platSearchTerms];
                                      newTerms[idx] = p.nombre;
                                      setPlatSearchTerms(newTerms);
                                      setActivePlatIndex(null);
                                    }}
                                    className="w-full text-left px-5 py-3 hover:bg-slate-800 text-slate-300 hover:text-white font-bold text-[10px] transition-colors border-b border-slate-800 last:border-0 uppercase"
                                  >
                                    <div className="flex justify-between items-center">
                                      <div className="flex items-center gap-3">
                                        <img src={p.imagenUrl} alt="" className="w-5 h-5 object-contain" />
                                        <span>{p.nombre}</span>
                                      </div>
                                      <span className="text-[9px] text-emerald-400">${p.precioVenta}</span>
                                    </div>
                                  </button>
                                ))}
                            </div>
                          )}
                        </div>
                        <div className="space-y-3 relative z-[5]">
                          <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Perfil/Acceso</label>
                          <div className="flex gap-3">
                            <input required placeholder="Ej: Perfil 1 / Pin 1234" value={item.perfil} onChange={e => updateItem(idx, 'perfil', e.target.value)} className="flex-1 bg-slate-900 border border-slate-700/50 rounded-xl px-4 py-3 text-white font-black text-[11px] outline-none focus:ring-1 focus:ring-indigo-500/30" />
                            {formData.items.length > 1 && (
                              <button type="button" onClick={() => removeItem(idx)} className="p-4 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-2xl transition-all"><Trash2 size={16}/></button>
                            )}
                          </div>
                          {item.prevId && item.oldExpiry && (
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-500/5 border border-indigo-500/20 rounded-xl w-max">
                              <Clock size={10} className="text-indigo-400" />
                              <span className="text-[8px] font-black text-indigo-300 uppercase tracking-tighter">
                                Próximo Vencimiento: {dayjs(item.oldExpiry).add(platforms.find(p => p.id === item.plataformaId)?.vigenciaDias || 30, 'day').format('DD MMM YYYY')}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {formData.items.length > 0 && (
                  <div className="flex justify-center pt-4">
                    <button type="button" onClick={addItem} className="flex items-center gap-3 px-6 py-3 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-indigo-500/20 active:scale-95">
                      <PlusCircle size={18} strokeWidth={3} /> Añadir Otra Cuenta
                    </button>
                  </div>
                )}
              </div>

              {/* RESUMEN DE PRECIOS */}
              {(() => {
                const { sumVenta, discount, finalVenta, totalGanancia } = calculateTotals();
                if (sumVenta === 0) return null;
                return (
                  <div className="bg-indigo-600/5 border border-indigo-500/20 p-5 rounded-2xl space-y-3 animate-in slide-in-from-bottom-4">
                    <div className="flex justify-between items-center pb-4 border-b border-indigo-500/10">
                      <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Subtotal Bruto</span>
                      <span className="text-sm font-bold text-slate-300">${sumVenta.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between items-center pb-4 border-b border-indigo-500/10">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={14} className="text-emerald-500" />
                          <span className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">Descuento aplicado</span>
                        </div>
                        <span className="text-sm font-bold text-emerald-500">-${discount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-2">
                       <div className="flex flex-col">
                         <span className="text-[11px] font-black uppercase text-white tracking-[0.2em]">Total a pagar</span>
                         <span className="text-[8px] font-bold text-emerald-400 uppercase italic opacity-60">Ganancia Estimada: ${totalGanancia.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}</span>
                       </div>
                       <span className="text-3xl font-black text-white italic tracking-tighter">${finalVenta.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}</span>
                    </div>
                  </div>
                );
              })()}

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-400 font-black rounded-2xl transition-all uppercase text-[10px] tracking-widest">Descartar</button>
                <button type="submit" disabled={loading} className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow-xl transition-all uppercase text-[10px] tracking-widest">
                  {loading ? 'Procesando...' : 'Finalizar Registro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md"></div>
          <div className="relative w-full max-w-lg bg-slate-900 rounded-[32px] border border-slate-800 shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden">
            <div className="flex items-center justify-between px-7 py-5 border-b border-slate-800 shrink-0">
              <h3 className="text-xl font-black italic tracking-tighter uppercase text-white">Editar Perfil</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="p-3 hover:bg-slate-800 rounded-2xl transition-all"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleUpdateSale} className="px-7 py-5 space-y-6 overflow-y-auto scrollbar-hide flex-1">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest leading-none">Segmento</label>
                <div className="relative">
                  <select required value={editFormData.tipoCliente} onChange={e => setEditFormData({...editFormData, tipoCliente: e.target.value, cliente: '', contacto: ''})} className="w-full bg-slate-900 border border-slate-700/50 rounded-xl px-4 py-3 text-white font-black text-xs appearance-none">
                    <option value="Final" className="bg-slate-900">CLIENTE FINAL</option>
                    <option value="Distribuidor" className="bg-slate-900">DISTRIBUIDOR</option>
                  </select>
                  <ChevronDown size={20} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {editFormData.tipoCliente === 'Distribuidor' ? (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest leading-none">Socio / Grupo</label>
                    <div className="relative">
                      <select 
                        required 
                        value={editFormData.cliente} 
                        onChange={e => {
                          const d = distribuidores.find(x => x.nombre === e.target.value);
                          setEditFormData({...editFormData, cliente: e.target.value, contacto: d?.whatsappLink || ''});
                        }} 
                        className="w-full bg-slate-900 border border-slate-700/50 rounded-xl px-4 py-3 text-white font-black text-xs appearance-none"
                      >
                        <option value="" disabled className="bg-slate-900">SELECCIONAR SOCIO...</option>
                        {distribuidores.map(d => (
                          <option key={d.id} value={d.nombre} className="bg-slate-900">{d.nombre.toUpperCase()}</option>
                        ))}
                      </select>
                      <ChevronDown size={20} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest leading-none">Nombre Cliente</label>
                    <input required value={editFormData.cliente} onChange={e => setEditFormData({...editFormData, cliente: e.target.value})} className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white font-black text-xs" />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest leading-none">WhatsApp</label>
                    <input required value={editFormData.contacto} onChange={e => setEditFormData({...editFormData, contacto: e.target.value})} className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white font-black text-xs" />
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest leading-none">Acceso / Perfil</label>
                  <input required value={editFormData.perfil} onChange={e => setEditFormData({...editFormData, perfil: e.target.value})} className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white font-black text-xs outline-none focus:ring-2 focus:ring-indigo-500/20" />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest leading-none">Fecha de Inicio</label>
                  <div className="relative group cursor-pointer" onClick={(e) => e.currentTarget.querySelector('input').showPicker()}>
                    <div className="absolute inset-0 bg-indigo-500/5 group-hover:bg-indigo-500/10 rounded-2xl transition-all border border-slate-700/50 group-hover:border-indigo-500/50 group-hover:shadow-[0_0_20px_-5px_rgba(99,102,241,0.2)]"></div>
                    <div className="relative flex items-center px-4 py-3 gap-4">
                      <div className="flex flex-col items-center">
                        <span className="text-lg font-black text-indigo-400 leading-none">{dayjs(editFormData.fechaCompra).format('DD')}</span>
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">{dayjs(editFormData.fechaCompra).format('MMM')}</span>
                      </div>
                      <div className="w-[1px] h-8 bg-slate-800"></div>
                      <div className="flex-1">
                        <h4 className="text-[10px] font-black text-white uppercase tracking-widest">{dayjs(editFormData.fechaCompra).format('dddd')}</h4>
                        <p className="text-[9px] font-bold text-slate-500 uppercase">{dayjs(editFormData.fechaCompra).format('MMMM [del] YYYY')}</p>
                      </div>
                      <Calendar size={20} className="text-slate-600 group-hover:text-indigo-400 transition-colors" />
                    </div>
                    <input 
                      required 
                      type="date" 
                      value={editFormData.fechaCompra} 
                      onChange={e => setEditFormData({...editFormData, fechaCompra: e.target.value})} 
                      className="absolute inset-0 opacity-0 cursor-pointer" 
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 py-3.5 bg-slate-800 text-slate-400 font-black rounded-2xl transition-all uppercase text-[10px] tracking-widest">Descartar</button>
                <button type="submit" className="flex-1 py-3.5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl transition-all uppercase text-[10px] tracking-widest">Actualizar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl animate-in fade-in"></div>
          <div className="relative w-full max-w-sm bg-slate-900 rounded-[32px] border border-slate-800 p-8 shadow-3xl text-center space-y-8 animate-in zoom-in-95 duration-300 my-auto">
            <div className="flex flex-col items-center gap-8">
              <div className={`p-6 rounded-[24px] ${confirmModal.color === 'red' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>{confirmModal.icon}</div>
              <div className="space-y-3">
                <h3 className="text-2xl font-black italic tracking-tighter uppercase">{confirmModal.title}</h3>
                <p className="text-slate-500 font-bold uppercase text-[9px] tracking-[0.2em] px-6">{confirmModal.message}</p>
              </div>
            </div>
            <div className="flex gap-4 pt-4">
               <button onClick={() => setConfirmModal({...confirmModal, isOpen: false})} className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-white font-black rounded-[24px] transition-all text-[10px] uppercase tracking-widest">Volver</button>
               <button onClick={handleConfirmedAction} disabled={loading} className={`flex-1 py-4 ${confirmModal.color === 'red' ? 'bg-red-600 shadow-red-600/20' : 'bg-emerald-600 shadow-emerald-600/20'} text-white font-black rounded-[24px] shadow-2xl active:scale-95 transition-all text-[10px] uppercase tracking-widest`}>{loading ? '...' : 'Aceptar'}</button>
            </div>
          </div>
        </div>
      )}
      {selectedSales.length > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[80] bg-slate-900/80 backdrop-blur-xl border border-indigo-500/30 px-8 py-5 rounded-[30px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] flex items-center gap-10 animate-in slide-in-from-bottom-10 border-t border-t-white/5">
          <div className="flex flex-col">
            <span className="text-[11px] font-black uppercase text-indigo-400 tracking-[0.2em]">{selectedSales.length} Seleccionados</span>
            <span className="text-[8px] font-bold text-slate-500 uppercase">Combo en preparación</span>
          </div>
          <div className="flex gap-4">
            <button onClick={handleOpenBulkRenovate} className="flex items-center gap-3 px-8 py-4 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-2xl hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/20 active:scale-95">
              <RefreshCw size={16} /> Renovar Combo
            </button>
            <button onClick={() => setSelectedSales([])} className="px-8 py-4 bg-slate-800 text-slate-400 text-[10px] font-black uppercase rounded-2xl hover:bg-slate-700 transition-all active:scale-95">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
