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
  
  const [filterMonth, setFilterMonth] = useState('Todos');
  const [filterType, setFilterType] = useState('Todos');
  const [filterStatus, setFilterStatus] = useState('Todos'); 
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  const [selectedSales, setSelectedSales] = useState([]);
  const [distribuidores, setDistribuidores] = useState([]);
  
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
  };

  const removeItem = (index) => {
    if (formData.items.length <= 1) return;
    const newItems = [...formData.items];
    newItems.splice(index, 1);
    setFormData(prev => ({ ...prev, items: newItems }));
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

    const message = `Hola ${sale.cliente}, te saludamos de Grupoxua. 👋 Te recordamos que pronto vence tu ${platformLabel}. ¿Deseas renovar el servicio? 🚀`;
    
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
      fechaVenta: dayjs().format('YYYY-MM-DD'),
      items: selected.map(s => ({
        plataformaId: s.plataformaId,
        perfil: s.perfil,
        prevId: s.id,
        oldExpiry: s.fechaVencimiento
      }))
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (sale) => {
    setEditingSale(sale);
    setEditFormData({
      cliente: sale.cliente, contacto: sale.contacto, perfil: sale.perfil, tipoCliente: sale.tipoCliente
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
          fechaCompra: now.toISOString(),
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
      await updateDoc(doc(db, 'ventas', editingSale.id), {
        cliente: editFormData.cliente, contacto: editFormData.contacto, perfil: editFormData.perfil, tipoCliente: editFormData.tipoCliente
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

  const uniqueMonths = [...new Set(sales.map(s => dayjs(s.fechaCompra).format('MMMM YYYY')))];
  uniqueMonths.sort((a, b) => dayjs(b, 'MMMM YYYY').diff(dayjs(a, 'MMMM YYYY')));

  const filteredSales = sales.filter(s => {
    const sMonth = dayjs(s.fechaCompra).format('MMMM YYYY');
    const matchesMonth = filterMonth === 'Todos' || sMonth === filterMonth;
    const matchesType = filterType === 'Todos' || s.tipoCliente === filterType;
    const matchesStatus = filterStatus === 'Todos' || (s.estado || 'Activo') === filterStatus;
    const matchesSearch = 
      s.cliente.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (s.perfil && s.perfil.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesMonth && matchesType && matchesSearch && matchesStatus;
  });

  // Reset page when filters change
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
          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">Página {currentPage}</span>
          <span className="text-[7px] font-bold text-slate-600 uppercase tracking-widest mt-0.5">de {totalPages} | {filteredSales.length} Ventas</span>
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

      <div className="grid grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 bg-slate-900/40 p-4 rounded-[32px] border border-slate-800 shadow-inner">
        {/* BUSCADOR - ABAJO EN MOBILE, PRIMERO EN DESKTOP */}
        <div className="col-span-3 lg:col-span-1 order-4 lg:order-1 relative group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={20} />
          <input type="text" placeholder="BUSCAR CLIENTE..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-slate-800/50 border border-slate-700/50 rounded-2xl pl-12 pr-6 py-4 text-white text-[10px] uppercase font-black outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-600" />
        </div>

        {/* FILTROS - LADO A LADO EN MOBILE */}
        <div className="col-span-1 order-1 lg:order-2 relative">
          <Calendar className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-slate-500 hidden sm:block" size={18} />
          <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="w-full bg-slate-900 border border-slate-700/50 rounded-xl sm:rounded-2xl pl-4 sm:pl-12 pr-6 py-4 text-white text-[9px] sm:text-[10px] font-black uppercase appearance-none cursor-pointer">
            <option value="Todos" className="bg-slate-900">MeseS</option>
            {uniqueMonths.map(m => <option key={m} value={m} className="bg-slate-900 text-xs">{m}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        </div>

        <div className="col-span-1 order-2 lg:order-3 relative">
          <Filter className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-slate-500 hidden sm:block" size={18} />
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-full bg-slate-900 border border-slate-700/50 rounded-xl sm:rounded-2xl pl-4 sm:pl-12 pr-6 py-4 text-white text-[9px] sm:text-[10px] font-black uppercase appearance-none cursor-pointer">
            <option value="Todos" className="bg-slate-900">TIPO</option>
            <option value="Final" className="bg-slate-900">FINAL</option>
            <option value="Distribuidor" className="bg-slate-900">SOCIO</option>
          </select>
          <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        </div>

        <div className="col-span-1 order-3 lg:order-4 relative">
          <CheckCircle2 className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-slate-500 hidden sm:block" size={18} />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full bg-slate-900 border border-slate-700/50 rounded-xl sm:rounded-2xl pl-4 sm:pl-12 pr-6 py-4 text-white text-[9px] sm:text-[10px] font-black uppercase appearance-none cursor-pointer">
            <option value="Todos" className="bg-slate-900">Estado</option>
            <option value="Activo" className="bg-slate-900">ACTIVO</option>
            <option value="Renovado" className="bg-slate-900">RENOVADO</option>
          </select>
          <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        </div>
      </div>

      <PaginationControls />

      {/* DESKTOP TABLE VIEW */}
      <div className="hidden lg:block bg-slate-900/40 rounded-[40px] border border-slate-800 overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-y-2">
            <thead>
              <tr className="bg-transparent">
                <th className="px-8 py-4 text-left">
                  <button onClick={() => {
                    if (selectedSales.length === filteredSales.length) setSelectedSales([]);
                    else setSelectedSales(filteredSales.map(s => s.id));
                  }} className={`p-2 rounded-lg border-2 transition-all ${selectedSales.length === filteredSales.length && filteredSales.length > 0 ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-slate-800 text-slate-800 hover:border-slate-700'}`}>
                    <CheckCircle2 size={14} />
                  </button>
                </th>
                <th className="px-8 py-5 text-left text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Cliente</th>
                <th className="px-8 py-5 text-center text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Servicio</th>
                <th className="px-8 py-5 text-left text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Perfil</th>
                <th className="px-8 py-5 text-left text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Corte</th>
                <th className="px-8 py-5 text-left text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Ganancia</th>
                <th className="px-8 py-5 text-left text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Estado</th>
                <th className="px-8 py-5 text-right text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="px-8">
              {paginatedSales.map((sale) => {
                const diffDays = dayjs(sale.fechaVencimiento).diff(dayjs(), 'day');
                const isExpired = diffDays < 0;
                const isToday = diffDays === 0;

                return (
                  <tr key={sale.id} className={`group ${selectedSales.includes(sale.id) ? 'bg-indigo-500/10 border-l-4 border-indigo-500' : 'bg-slate-900/60 hover:bg-slate-800 border-l-4 border-transparent hover:border-indigo-500/50'} transition-all duration-500 shadow-xl hover:scale-[1.01] hover:shadow-indigo-500/5`}>
                    <td className="px-8 py-6 rounded-l-[20px]">
                      {sale.estado !== 'Renovado' && !isExpired && (
                        <button onClick={() => {
                          setSelectedSales(prev => prev.includes(sale.id) ? prev.filter(id => id !== sale.id) : [...prev, sale.id]);
                        }} className={`p-2.5 rounded-xl border-2 transition-all ${selectedSales.includes(sale.id) ? 'bg-indigo-600 border-indigo-500 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]' : 'border-slate-800 text-slate-700 hover:border-slate-600'}`}>
                          <CheckCircle2 size={14} strokeWidth={3} />
                        </button>
                      )}
                    </td>
                    <td className="px-8 py-6">
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
                    <td className="px-8 py-6">
                      <div className="flex items-center justify-center">
                        <img src={sale.plataformaImagenUrl} alt="" className="w-12 h-12 object-contain drop-shadow-lg group-hover:scale-110 transition-transform duration-500" />
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="font-black text-sm text-slate-300 uppercase tracking-tighter">{sale.perfil || 'N/A'}</span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-1">
                        <span className="text-[11px] font-black text-white uppercase tracking-tighter">{dayjs(sale.fechaVencimiento).format('DD MMM YYYY')}</span>
                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md w-max border ${isExpired ? 'bg-red-500/10 text-red-500 border-red-500/20' : isToday ? 'bg-orange-500/10 text-orange-400 border-orange-500/20 animate-pulse' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                           <Clock size={10} />
                           <span className="text-[9px] font-black uppercase">{isExpired ? 'Vencido' : isToday ? 'Vence hoy' : `${diffDays} días`}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-emerald-400 font-black text-sm tracking-tighter">${(sale.ganancia || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}</span>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full border ${
                        sale.estado === 'Renovado' ? 'bg-slate-500/10 text-slate-500 border-slate-500/20' : 
                        isExpired ? 'bg-slate-500/10 text-slate-500 border-slate-500/20' : 
                        'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}>
                        {sale.estado === 'Renovado' ? 'Renovado' : isExpired ? 'Vencido' : 'Activo'}
                      </span>
                    </td>
                    <td className="px-8 py-6 rounded-r-[20px]">
                      <div className="flex items-center justify-end gap-2.5 translate-x-4 group-hover:translate-x-0 opacity-0 group-hover:opacity-100 transition-all duration-500">
                         {sale.estado !== 'Renovado' && !isExpired && (
                           <>
                             <button 
                               onClick={() => handleWhatsAppReminder(sale)}
                               className="p-3 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-xl transition-all shadow-lg active:scale-95"
                               title="Enviar recordatorio WhatsApp"
                             >
                                <MessageCircle size={18} />
                             </button>
                             <button 
                               onClick={() => handleOpenBulkRenovate([sale.id])}
                               className="p-3 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white rounded-xl transition-all shadow-lg active:scale-95"
                               title="Renovar plataforma"
                             >
                                <RefreshCw size={18} />
                             </button>
                             <button 
                               onClick={() => handleOpenEditModal(sale)}
                               className="p-3 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white rounded-xl transition-all"
                               title="Editar perfil"
                             >
                                <Edit3 size={18} />
                             </button>
                           </>
                         )}
                         <button 
                            onClick={() => showConfirm('delete', sale)}
                            className="p-3 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all"
                         >
                            <Trash2 size={18} />
                         </button>
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
          const diffDays = dayjs(sale.fechaVencimiento).diff(dayjs(), 'day');
          const isExpired = diffDays < 0;
          const isToday = diffDays === 0;

          return (
            <div key={sale.id} className={`group relative bg-slate-900/40 p-4 rounded-2xl border border-slate-800/60 transition-all active:scale-[0.98] ${selectedSales.includes(sale.id) ? 'border-indigo-500/50 bg-indigo-500/5' : ''}`}>
              <div className="flex items-center gap-4">
                {/* Selection Control - Mobile */}
                {sale.estado !== 'Renovado' && !isExpired && (
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
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-[10px] font-black text-white leading-none">{dayjs(sale.fechaVencimiento).format('DD MMM')}</p>
                      <p className={`text-[7px] font-black uppercase tracking-widest ${isExpired ? 'text-red-500' : 'text-slate-500'}`}>
                        {isExpired ? 'VENCIDO' : `${diffDays} DÍAS`}
                      </p>
                    </div>
                    <div className="w-[1px] h-6 bg-slate-800"></div>
                    <div className="flex items-center gap-1.5 focus-within:ring-0">
                      {sale.estado !== 'Renovado' && !isExpired && (
                        <>
                          <button onClick={() => handleWhatsAppReminder(sale)} className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-lg active:bg-emerald-500 active:text-white transition-all"><MessageCircle size={14}/></button>
                          <button onClick={() => handleOpenBulkRenovate([sale.id])} className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-lg active:bg-indigo-500 active:text-white transition-all"><RefreshCw size={14}/></button>
                          <button 
                            onClick={() => {
                              setEditingSale(sale);
                              setEditFormData({
                                id: sale.id, cliente: sale.cliente, contacto: sale.contacto,
                                perfil: sale.perfil || '', tipoCliente: sale.tipoCliente || 'Final'
                              });
                              setIsEditModalOpen(true);
                            }}
                            className="p-2.5 bg-slate-800 text-slate-400 rounded-lg"
                          >
                            <Edit3 size={14}/>
                          </button>
                        </>
                      )}
                      <button 
                        onClick={() => handleDelete(sale.id)}
                        className="p-2.5 bg-red-500/10 text-red-500 rounded-lg active:bg-red-600 active:text-white transition-all"
                      >
                        <Trash2 size={14}/>
                      </button>
                    </div>
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
            <div className="p-24 text-center space-y-6">
              <div className="inline-block p-8 bg-slate-800 rounded-[40px] text-slate-600 border border-slate-700"><AlertCircle size={50} /></div>
              <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-[10px]">No se detectaron registros activos.</p>
            </div>
          )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md"></div>
          <div className="relative w-full max-w-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/20 rounded-[50px] border border-slate-800 shadow-2xl animate-in zoom-in h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-8 sm:p-10 border-b border-slate-800 shrink-0">
              <h3 className="text-3xl font-black italic tracking-tighter uppercase text-white">Nueva Venta</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-slate-800 rounded-2xl transition-all"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 sm:p-12 space-y-12 overflow-y-auto scrollbar-hide flex-1">
              {/* DATOS DEL CLIENTE */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-1 bg-indigo-500 rounded-full"></div>
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em]">Información del Cliente</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest leading-none">Segmento</label>
                    <div className="relative">
                      <select required value={formData.tipoCliente} onChange={e => setFormData({...formData, tipoCliente: e.target.value, cliente: '', contacto: ''})} className="w-full bg-slate-900 border border-slate-700/50 rounded-2xl px-6 py-5 text-white font-black text-xs appearance-none cursor-pointer">
                        <option value="" disabled className="bg-slate-900">SELECCIONAR...</option>
                        <option value="Final" className="bg-slate-900">CLIENTE FINAL</option>
                        <option value="Distribuidor" className="bg-slate-900">DISTRIBUIDOR</option>
                      </select>
                      <ChevronDown size={20} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  {formData.tipoCliente === 'Distribuidor' ? (
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest leading-none">Socio / Grupo</label>
                      <div className="relative">
                        <select 
                          required 
                          value={formData.cliente} 
                          onChange={e => {
                            const d = distribuidores.find(x => x.nombre === e.target.value);
                            setFormData({...formData, cliente: e.target.value, contacto: d?.whatsappLink || ''});
                          }} 
                          className="w-full bg-slate-900 border border-slate-700/50 rounded-2xl px-6 py-5 text-white font-black text-xs appearance-none cursor-pointer"
                        >
                          <option value="" disabled className="bg-slate-900">SELECCIONAR SOCIO...</option>
                          {distribuidores.map(d => (
                            <option key={d.id} value={d.nombre} className="bg-slate-900">{d.nombre.toUpperCase()}</option>
                          ))}
                        </select>
                        <ChevronDown size={20} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest leading-none">Cliente</label>
                      <input required placeholder="Ej: Juan Pérez" value={formData.cliente} onChange={e => setFormData({...formData, cliente: e.target.value})} className="w-full bg-slate-800/50 border border-slate-700/50 rounded-2xl px-6 py-5 text-white font-black text-xs outline-none focus:ring-2 focus:ring-indigo-500/20" />
                    </div>
                  )}
                </div>

                <div className={`flex flex-col sm:flex-row ${formData.tipoCliente === 'Final' ? 'sm:gap-8' : 'sm:gap-0'} items-start transition-all duration-500`}>
                  <div className={`transition-all duration-500 ease-out overflow-hidden ${formData.tipoCliente === 'Final' ? 'w-full sm:w-1/2 opacity-100 translate-x-0' : 'w-0 h-0 opacity-0 -translate-x-10 pointer-events-none'}`}>
                    <div className="space-y-3 min-w-[200px]">
                      <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest leading-none">WhatsApp</label>
                      <input required={formData.tipoCliente === 'Final'} placeholder="+57 300 000 0000" value={formData.contacto} onChange={e => setFormData({...formData, contacto: e.target.value})} className="w-full bg-slate-800/50 border border-slate-700/50 rounded-2xl px-6 py-5 text-white font-black text-xs outline-none focus:ring-2 focus:ring-indigo-500/20" />
                    </div>
                  </div>
                  <div className={`w-full sm:w-1/2 space-y-3 transition-all duration-500 ease-out ${formData.tipoCliente !== 'Final' ? 'sm:-ml-0' : ''}`}>
                    <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest leading-none">Fecha de Inicio</label>
                    <div className="relative group cursor-pointer" onClick={(e) => e.currentTarget.querySelector('input').showPicker()}>
                      <div className="absolute inset-0 bg-indigo-500/5 group-hover:bg-indigo-500/10 rounded-2xl transition-all border border-slate-700/50 group-hover:border-indigo-500/50 group-hover:shadow-[0_0_20px_-5px_rgba(99,102,241,0.2)]"></div>
                      <div className="relative flex items-center px-6 py-4 gap-6">
                        <div className="flex flex-col items-center">
                          <span className="text-2xl font-black text-indigo-400 leading-none">{dayjs(formData.fechaVenta).format('DD')}</span>
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
              <div className="space-y-6">
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
                    <div key={idx} className="group relative bg-slate-950/40 p-6 rounded-3xl border border-slate-800/50 hover:border-indigo-500/30 transition-all">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Plataforma</label>
                          <div className="relative">
                            <select required value={item.plataformaId} onChange={e => updateItem(idx, 'plataformaId', e.target.value)} className="w-full bg-slate-900 border border-slate-700/50 rounded-2xl px-5 py-4 text-white font-black text-[11px] appearance-none cursor-pointer">
                              <option value="" disabled className="bg-slate-900">PLATAFORMA...</option>
                              {platforms.filter(p => p.activa && p.tipo === formData.tipoCliente).map(p => (
                                <option key={p.id} value={p.id} className="bg-slate-900">{p.nombre.toUpperCase()}</option>
                              ))}
                            </select>
                            <ChevronDown size={14} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                          </div>
                        </div>
                        <div className="space-y-3">
                          <label className="text-[9px] font-black uppercase text-slate-600 ml-1">Perfil/Acceso</label>
                          <div className="flex gap-3">
                            <input required placeholder="Ej: Perfil 1 / Pin 1234" value={item.perfil} onChange={e => updateItem(idx, 'perfil', e.target.value)} className="flex-1 bg-slate-900 border border-slate-700/50 rounded-2xl px-5 py-4 text-white font-black text-[11px] outline-none focus:ring-1 focus:ring-indigo-500/30" />
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
                    <button type="button" onClick={addItem} className="flex items-center gap-3 px-8 py-4 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-indigo-500/20 hover:scale-105 active:scale-95">
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
                  <div className="bg-indigo-600/5 border border-indigo-500/20 p-8 rounded-[40px] space-y-6 animate-in slide-in-from-bottom-4">
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

              <div className="flex gap-6 pt-10 mt-auto">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-5 bg-slate-800 hover:bg-slate-700 text-slate-400 font-black rounded-3xl transition-all uppercase text-[10px] tracking-widest">Descartar</button>
                <button type="submit" disabled={loading} className="flex-1 py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-3xl shadow-xl transition-all uppercase text-[10px] tracking-widest">
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
          <div className="relative w-full max-w-lg bg-slate-900 rounded-[50px] border border-slate-800 shadow-2xl animate-in zoom-in overflow-hidden">
            <div className="flex items-center justify-between p-10 border-b border-slate-800">
              <h3 className="text-3xl font-black italic tracking-tighter uppercase text-white">Editar Perfil</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="p-3 hover:bg-slate-800 rounded-2xl transition-all"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleUpdateSale} className="p-10 space-y-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest leading-none">Segmento</label>
                <div className="relative">
                  <select required value={editFormData.tipoCliente} onChange={e => setEditFormData({...editFormData, tipoCliente: e.target.value, cliente: '', contacto: ''})} className="w-full bg-slate-900 border border-slate-700/50 rounded-2xl px-6 py-5 text-white font-black text-xs appearance-none">
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
                        className="w-full bg-slate-900 border border-slate-700/50 rounded-2xl px-6 py-5 text-white font-black text-xs appearance-none"
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest leading-none">Nombre Cliente</label>
                    <input required value={editFormData.cliente} onChange={e => setEditFormData({...editFormData, cliente: e.target.value})} className="w-full bg-slate-800/50 border border-slate-700/50 rounded-2xl px-6 py-5 text-white font-black text-xs" />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest leading-none">WhatsApp</label>
                    <input required value={editFormData.contacto} onChange={e => setEditFormData({...editFormData, contacto: e.target.value})} className="w-full bg-slate-800/50 border border-slate-700/50 rounded-2xl px-6 py-5 text-white font-black text-xs" />
                  </div>
                </div>
              )}
              
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest leading-none">Acceso / Perfil</label>
                <input required value={editFormData.perfil} onChange={e => setEditFormData({...editFormData, perfil: e.target.value})} className="w-full bg-slate-800/50 border border-slate-700/50 rounded-2xl px-6 py-5 text-white font-black text-xs" />
              </div>
              <div className="flex gap-6 pt-10">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 py-5 bg-slate-800 text-slate-400 font-black rounded-3xl uppercase text-[10px] tracking-widest">Descartar</button>
                <button type="submit" className="flex-1 py-5 bg-indigo-600 text-white font-black rounded-3xl uppercase text-[10px] tracking-widest">Actualizar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl animate-in fade-in"></div>
          <div className="relative w-full max-w-md bg-slate-900 rounded-[50px] border border-slate-800 p-12 shadow-3xl text-center space-y-10 animate-in zoom-in my-auto">
            <div className="flex flex-col items-center gap-8">
              <div className={`p-10 rounded-[35px] ${confirmModal.color === 'red' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>{confirmModal.icon}</div>
              <div className="space-y-3">
                <h3 className="text-3xl font-black italic tracking-tighter uppercase">{confirmModal.title}</h3>
                <p className="text-slate-500 font-bold uppercase text-[9px] tracking-[0.2em] px-6">{confirmModal.message}</p>
              </div>
            </div>
            <div className="flex gap-4 pt-4">
               <button onClick={() => setConfirmModal({...confirmModal, isOpen: false})} className="flex-1 py-5 bg-slate-800 hover:bg-slate-700 text-white font-black rounded-[24px] transition-all text-[10px] uppercase tracking-widest">Volver</button>
               <button onClick={handleConfirmedAction} disabled={loading} className={`flex-1 py-5 ${confirmModal.color === 'red' ? 'bg-red-600 shadow-red-600/20' : 'bg-emerald-600 shadow-emerald-600/20'} text-white font-black rounded-[24px] shadow-2xl active:scale-95 transition-all text-[10px] uppercase tracking-widest`}>{loading ? '...' : 'Aceptar'}</button>
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
