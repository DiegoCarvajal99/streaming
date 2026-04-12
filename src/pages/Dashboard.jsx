import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, LineChart, Line, Legend, AreaChart, Area, LabelList
} from 'recharts';
import dayjs from 'dayjs';
import 'dayjs/locale/es'; 
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { TrendingUp, Users, DollarSign, ShoppingCart, Calendar, ArrowUpRight, ArrowDownRight, Activity, Percent, Zap, Clock, MessageCircle, CheckCircle2, RefreshCw, X, ChevronDown, PlusCircle, Trash2, LayoutDashboard, MoreHorizontal, Filter } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Extender dayjs
dayjs.extend(customParseFormat);
// Forzar español
dayjs.locale('es');

const MESES_ABR = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const MESES_FULL = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export default function Dashboard() {
  const { userMetadata } = useAuth();
  const [allSales, setAllSales] = useState([]);
  const [data, setData] = useState([]);
  const [yearFilter, setYearFilter] = useState(dayjs().year().toString());
  const [yearOptions, setYearOptions] = useState([dayjs().year().toString()]);
  const [selectedDay, setSelectedDay] = useState(dayjs().format('YYYY-MM-DD'));
  const [stats, setStats] = useState({
    totalGanancia: 0,
    totalVentas: 0,
    ventasFinal: 0,
    ventasDistribuidor: 0,
    ticketPromedio: 0
  });

  const [todayExpiries, setTodayExpiries] = useState([]);

  const [dailyStats, setDailyStats] = useState({
    ventas: 0,
    ganancia: 0,
    comparativaVentas: 0
  });

  const [loading, setLoading] = useState(true);
  const [segmentFilter, setSegmentFilter] = useState('Todos');
  const [monthFilter, setMonthFilter] = useState(dayjs().format('MMMM').toLowerCase());
  const [platforms, setPlatforms] = useState([]);
  const [distribuidores, setDistribuidores] = useState([]);

  // Estados para Modal de Renovación (Portado de Sales.jsx)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    cliente: '', contacto: '', tipoCliente: 'Final', fechaVenta: dayjs().format('YYYY-MM-DD'),
    items: [{ plataformaId: '', perfil: '', prevId: null, oldExpiry: null }]
  });

  // Lógica de Tooltip con Retardo (1s) e Interacción Dinámica
  const [showTooltip, setShowTooltip] = useState(false);
  const [activeIndex, setActiveIndex] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const tooltipTimer = useRef(null);

  const handleChartMouseMove = (state) => {
    if (state && state.activeTooltipIndex !== undefined) {
      if (state.activeTooltipIndex !== activeIndex) {
        if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
        tooltipTimer.current = null;
        setShowTooltip(false);
        setActiveIndex(state.activeTooltipIndex);
        
        tooltipTimer.current = setTimeout(() => {
          setShowTooltip(true);
        }, 1000);
      }
      setTooltipPos({ x: state.chartX + 30, y: state.chartY - 20 });
    } else {
      handleChartMouseLeave();
    }
  };

  const handleChartMouseLeave = () => {
    if (tooltipTimer.current) {
      clearTimeout(tooltipTimer.current);
      tooltipTimer.current = null;
    }
    setShowTooltip(false);
    setActiveIndex(null);
  };

  const handleWhatsAppReminder = (sale) => {
    let platformText = sale.plataformaNombre;
    
    if (sale.comboId) {
      const comboItems = allSales.filter(s => s.comboId === sale.comboId && s.estado === 'Activo');
      if (comboItems.length > 1) {
        platformText = `combo de ${comboItems.map(s => s.plataformaNombre).join(', ')}`;
      }
    }

    const expiryDate = dayjs(sale.fechaVencimiento);
    const today = dayjs().startOf('day');
    const diffDays = expiryDate.startOf('day').diff(today, 'day');

    let message = '';
    
    if (diffDays > 0) {
      const formattedDate = expiryDate.format('D [de] MMMM [del] YYYY');
      message = `Hola, espero que se encuentre muy bien. Le escribo para recordarle que su ${platformText} vence el ${formattedDate}. Aún cuenta con ${diffDays} ${diffDays === 1 ? 'día' : 'días'} de servicio, ¿le gustaría realizar la renovación de una vez para que no se quede sin acceso?`;
    } else {
      message = `Hola, espero que se encuentre muy bien. Le escribo para informarle que su ${platformText} vence el día de hoy. ¿Le gustaría realizar la renovación de su cuenta para que no pierda el acceso al contenido?`;
    }

    const cleanPhone = sale.contacto.replace(/\D/g, '');

    // Si el contacto empieza por http, asumimos que es un link de grupo
    if (sale.contacto?.startsWith('http')) {
      window.open(`${sale.contacto}?text=${encodeURIComponent(message)}`, '_blank');
    } else {
      window.open(`https://wa.me/${cleanPhone.startsWith('57') ? cleanPhone : '57' + cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
    }
  };

  const [platformRanking, setPlatformRanking] = useState([]);
  const fetchSales = async () => {
    try {
      const [salesSnap, platformsSnap, dSnap] = await Promise.all([
        getDocs(collection(db, 'ventas')),
        getDocs(collection(db, 'plataformas')),
        getDocs(collection(db, 'distribuidores'))
      ]);
      
      const sales = salesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const plats = platformsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      setPlatforms(plats);
      setDistribuidores(dSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(d => d.activo));
      
      const adjustedYears = [...new Set(sales.map(s => {
        const d = parseDate(s.fechaVencimiento || s.fechaVenta).subtract(1, 'month');
        return d.isValid() ? d.year().toString() : dayjs().year().toString();
      }))];
      
      const currentYear = dayjs().year().toString();
      const allYears = [...new Set([currentYear, ...adjustedYears])].sort((a, b) => b - a);
      setYearOptions(allYears);
      
      setAllSales(sales);
      
      const today = dayjs().format('YYYY-MM-DD');
      const expiringToday = sales.filter(s => 
        s.estado === 'Activo' && 
        parseDate(s.fechaVencimiento).format('YYYY-MM-DD') === today
      );
      setTodayExpiries(expiringToday);

      processData(sales, segmentFilter, monthFilter, yearFilter);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  // LÓGICA DE RENOVACIÓN (Portado de Sales.jsx)
  const updateItem = (idx, field, val) => {
    const newItems = [...formData.items];
    newItems[idx][field] = val;
    setFormData({ ...formData, items: newItems });
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { plataformaId: '', perfil: '', prevId: null, oldExpiry: null }]
    });
  };

  const removeItem = (idx) => {
    setFormData({ ...formData, items: formData.items.filter((_, i) => i !== idx) });
  };

  const calculateTotals = () => {
    let sumVenta = 0;
    let sumCpra = 0;
    const items = formData.items;
    const count = items.length;

    items.forEach(item => {
      const p = platforms.find(x => x.id === item.plataformaId);
      if (p) {
        const parsePrice = (val) => Number(String(val).replace(/\./g, '')) || 0;
        sumVenta += parsePrice(p.precioVenta);
        sumCpra += parsePrice(p.precioCompra);
      }
    });

    let discount = 0;
    if (formData.tipoCliente === 'Final' && count >= 2) {
      discount = 1000 * count;
    } else if (formData.tipoCliente === 'Distribuidor' && count >= 2 && sumCpra >= 10000) {
      if (count === 2) discount = 500;
      else if (count === 3) discount = 1000;
      else if (count >= 4) discount = 1500;
    }

    const finalVenta = sumVenta - discount;
    const totalGanancia = finalVenta - sumCpra;
    return { sumVenta, discount, finalVenta, totalGanancia };
  };

  const handleOpenBulkRenovate = (manualIds = null) => {
    const targetIds = Array.isArray(manualIds) ? manualIds : [];
    const selected = allSales.filter(s => targetIds.includes(s.id));
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
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { discount } = calculateTotals();
      const count = formData.items.length;
      const discountPerItem = count > 0 ? Math.floor(discount / count) : 0;
      const comboId = `COMBO-${Date.now()}`;
      const now = dayjs();

      const savePromises = formData.items.map(async (item) => {
        const platform = platforms.find(p => p.id === item.plataformaId);
        if (!platform) return;

        const parsePrice = (val) => Number(String(val).replace(/\./g, '')) || 0;
        const vtaOriginal = parsePrice(platform.precioVenta);
        const cpraOriginal = parsePrice(platform.precioCompra);
        
        const vtaFinal = vtaOriginal - discountPerItem;
        const cpraFinal = cpraOriginal;

        const start = item.oldExpiry ? dayjs(item.oldExpiry) : now;
        const actualStart = (item.oldExpiry && start.isBefore(now)) ? now : start;
        const finalExpiry = actualStart.add(platform.vigenciaDias, 'day');

        const newSale = {
          cliente: formData.cliente,
          contacto: formData.contacto,
          tipoCliente: formData.tipoCliente,
          plataformaId: platform.id,
          plataformaNombre: platform.nombre,
          plataformaImagenUrl: platform.imagenUrl || '',
          perfil: item.perfil,
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

      // Registrar cliente si es nuevo (solo para tipo Final)
      if (formData.tipoCliente === 'Final' && formData.cliente?.trim()) {
        const cSnap = await getDocs(collection(db, 'clientes'));
        const existingClients = cSnap.docs.map(d => d.data());
        const clientExists = existingClients.some(c => c.nombre?.toLowerCase() === formData.cliente.toLowerCase());
        
        if (!clientExists) {
          await addDoc(collection(db, 'clientes'), {
            nombre: formData.cliente,
            contacto: formData.contacto,
            fechaRegistro: new Date().toISOString()
          });
        }
      }

      setIsModalOpen(false);
      fetchSales();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const parsePrice = (v) => {
    if (typeof v === 'number') return v;
    if (!v) return 0;
    const clean = String(v).replace(/[^-\d]/g, '');
    return Number(clean) || 0;
  };

  const getGanancia = (s) => {
     if (typeof s.ganancia === 'number') return s.ganancia;
     const keys = Object.keys(s);
     const key = keys.find(k => k.toLowerCase() === 'ganancia' || k.toLowerCase().includes('utilidad'));
     return key ? parsePrice(s[key]) : 0;
  };

  const parseDate = (s) => {
    if (s?.seconds) return dayjs(s.toDate());
    return dayjs(s);
  };

  const processData = (sales, segment, month, year) => {
    const monthlyDataMap = {};
    MESES_ABR.forEach((m, index) => { 
       monthlyDataMap[index] = { name: m, totalVentas: 0, ganancia: 0, index: index }; 
    });

    const getAccountingDate = (sale) => {
      return parseDate(sale.fechaCompra || sale.fechaVenta);
    };

    // 1. Filtrar ventas por AÑO
    let yearSales = sales.filter(s => {
       const d = getAccountingDate(s);
       return d.isValid() && d.year().toString() === year;
    });

    // 2. Filtrar ventas para ESTADÍSTICAS (Año + Mes + Segmento)
    let statsSales = [...yearSales];
    if (month !== 'Todos') {
      const selectedMonthIdx = MESES_FULL.indexOf(month.toLowerCase());
      statsSales = statsSales.filter(s => getAccountingDate(s).month() === selectedMonthIdx);
    }
    if (segment !== 'Todos') {
      statsSales = statsSales.filter(s => s.tipoCliente === segment);
    }

    // 3. Calcular Ranking (Año + Mes, IGNORAR Segmento)
    let rankingSales = [...yearSales];
    if (month !== 'Todos') {
      const selectedMonthIdx = MESES_FULL.indexOf(month.toLowerCase());
      rankingSales = rankingSales.filter(s => getAccountingDate(s).month() === selectedMonthIdx);
    }

    const platformCounts = {};
    rankingSales.forEach(s => {
      const name = (s.plataformaNombre || 'Otra').trim().toUpperCase();
      platformCounts[name] = (platformCounts[name] || 0) + 1;
    });
    
    const ranking = Object.entries(platformCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    setPlatformRanking(ranking);

    // 4. Preparar Data para Gráficas (SIEMPRE todo el año del filtro de año, respetando Segmento)
    let chartSales = [...yearSales];
    if (segment !== 'Todos') {
      chartSales = chartSales.filter(s => s.tipoCliente === segment);
    }
    
    chartSales.forEach(sale => {
      const d = getAccountingDate(sale);
      if (d.isValid()) {
        const monthIndex = d.month();
        if (monthlyDataMap[monthIndex] !== undefined) {
          monthlyDataMap[monthIndex].totalVentas += 1;
          monthlyDataMap[monthIndex].ganancia += getGanancia(sale);
        }
      }
    });

    const chartData = Object.values(monthlyDataMap).sort((a, b) => a.index - b.index);
    setData(chartData);

    // Stats finales basados en statsSales (Año + Mes + Segmento)
    const totalGanancia = statsSales.reduce((sum, s) => sum + getGanancia(s), 0);
    const totalVentas = statsSales.length;
    const vFinal = statsSales.filter(s => s.tipoCliente === 'Final').length;
    const vDist = statsSales.filter(s => s.tipoCliente === 'Distribuidor').length;

    setStats({
      totalGanancia, 
      totalVentas, 
      ventasFinal: vFinal,
      ventasDistribuidor: vDist,
      ticketPromedio: totalVentas > 0 ? Math.round(totalGanancia / totalVentas) : 0
    });
  };

  const processDailyStats = () => {
    if (!allSales || allSales.length === 0) return;
    
    const day = dayjs(selectedDay).format('YYYY-MM-DD');
    const yesterday = dayjs(selectedDay).subtract(1, 'day').format('YYYY-MM-DD');

    let filteredForDaily = [...allSales];
    if (segmentFilter !== 'Todos') {
      filteredForDaily = filteredForDaily.filter(s => s.tipoCliente === segmentFilter);
    }

    const todaySales = filteredForDaily.filter(s => {
      const d = parseDate(s.fechaCompra || s.fechaVenta);
      return d.isValid() && d.format('YYYY-MM-DD') === day;
    });

    const yesterdaySales = filteredForDaily.filter(s => {
      const d = parseDate(s.fechaCompra || s.fechaVenta);
      return d.isValid() && d.format('YYYY-MM-DD') === yesterday;
    });

    const totalTodayVentas = todaySales.length;
    const totalTodayGanancia = todaySales.reduce((sum, s) => sum + getGanancia(s), 0);
    const totalYesterdayVentas = yesterdaySales.length;

    setDailyStats({
      ventas: totalTodayVentas,
      ganancia: totalTodayGanancia,
      comparativaVentas: totalTodayVentas - totalYesterdayVentas
    });
  };

  useEffect(() => { fetchSales(); return () => { if (tooltipTimer.current) clearTimeout(tooltipTimer.current); }; }, []);

  useEffect(() => {
    if (allSales.length > 0) {
      processData(allSales, segmentFilter, monthFilter, yearFilter);
      processDailyStats();
    }
  }, [segmentFilter, monthFilter, yearFilter, allSales, selectedDay]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length && showTooltip) {
      const displayLabel = label === 'AGO' ? 'ATRÁS' : label;
      return (
        <div className="bg-slate-900/95 border border-slate-700/50 p-5 rounded-[22px] shadow-3xl backdrop-blur-xl animate-in fade-in zoom-in duration-300">
          <p className="text-[11px] font-black uppercase text-slate-400 mb-4 tracking-[0.2em] border-b border-slate-800 pb-3">{displayLabel}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center justify-between gap-12 py-1.5">
              <span className="text-[10px] font-black uppercase tracking-tight" style={{ color: entry.color }}>{entry.name}:</span>
              <span className="text-[15px] font-black text-white">{entry.name === 'GANANCIA' ? '$' : ''}{entry.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const getGreetingText = () => {
    const hour = dayjs().hour();
    if (hour >= 5 && hour < 12) return '¡Buenas días!,';
    if (hour >= 12 && hour < 18) return '¡Buenas tardes!,';
    return '¡Buenas noches!,';
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-1000">
      {/* HEADER & FILTERS */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl sm:text-4xl font-black italic tracking-tighter text-white">
                {getGreetingText()} <span className="text-indigo-500">{userMetadata?.name?.toString().split(' ')[0] || 'Administrador'}</span>
              </h1>
            </div>
            <div className="flex items-center gap-3">
               <div className="w-12 h-1 bg-slate-700 rounded-full"></div>
               <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em]">Panel • {yearFilter}</p>
            </div>
          </div>

          <div className="w-full xl:w-auto flex flex-col sm:flex-row items-center gap-3 bg-slate-900/40 p-2 sm:p-3 rounded-[32px] sm:rounded-[40px] border border-slate-800 shadow-2xl">
             <div className="grid grid-cols-2 sm:flex items-center gap-3 w-full sm:w-auto">
                {/* FILTRO AÑO */}
                <div className="relative group">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400 transition-colors" size={14} />
                  <select 
                    value={yearFilter}
                    onChange={(e) => setYearFilter(e.target.value)}
                    className="w-full bg-slate-800 border-none rounded-2xl pl-9 pr-6 py-3.5 text-[9px] sm:text-[10px] font-black uppercase text-white appearance-none cursor-pointer focus:ring-2 focus:ring-indigo-500/20"
                  >
                    {yearOptions.map(y => (
                      <option key={y} value={y} className="bg-slate-900">{y}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                </div>

                {/* FILTRO MES */}
                <div className="relative group">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-purple-400 transition-colors" size={14} />
                  <select 
                    value={monthFilter}
                    onChange={(e) => setMonthFilter(e.target.value)}
                    className="w-full bg-slate-800 border-none rounded-2xl pl-9 pr-6 py-3.5 text-[9px] sm:text-[10px] font-black uppercase text-white appearance-none cursor-pointer focus:ring-2 focus:ring-purple-500/20"
                  >
                    <option value="Todos" className="bg-slate-900">TODOS</option>
                    {(parseInt(yearFilter) === dayjs().year()
                      ? MESES_FULL.slice(0, dayjs().month() + 1)
                      : MESES_FULL
                    ).map(m => (
                      <option key={m} value={m} className="bg-slate-900 capitalize">{m}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                </div>
             </div>

             <div className="flex items-center bg-slate-950/40 p-1 rounded-[22px] border border-slate-800/50 w-full sm:w-auto">
                <button onClick={() => setSegmentFilter('Todos')} className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded-[18px] text-[9px] sm:text-[10px] font-black uppercase transition-all duration-300 ${segmentFilter === 'Todos' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-500'}`}>Todos</button>
                <button onClick={() => setSegmentFilter('Final')} className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded-[18px] text-[9px] sm:text-[10px] font-black uppercase transition-all duration-300 ${segmentFilter === 'Final' ? 'bg-purple-600 text-white shadow-xl' : 'text-slate-500'}`}>FINAL</button>
                <button onClick={() => setSegmentFilter('Distribuidor')} className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded-[18px] text-[9px] sm:text-[10px] font-black uppercase transition-all duration-300 ${segmentFilter === 'Distribuidor' ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-500'}`}>SOCIO</button>
             </div>
          </div>
        </div>

      <div className="bg-slate-900/40 border border-slate-800 p-6 sm:p-10 rounded-[40px] shadow-2xl group overflow-hidden relative">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-8 sm:gap-12">
           <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10">
              <div className="p-6 bg-indigo-600/10 rounded-[30px] border border-indigo-500/20 group-hover:scale-110 transition-transform duration-700">
                 <Zap size={32} className="text-amber-400 fill-amber-400/20" />
              </div>
              <div className="text-center sm:text-left">
                 <h3 className="text-3xl font-black text-white uppercase italic tracking-tighter leading-none">Resumen Diario</h3>
                 <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 justify-center sm:justify-start mt-2">
                    <Clock size={12}/> Métricas en Tiempo Real
                 </p>
              </div>
              
              <div className="relative group cursor-pointer" onClick={(e) => {
                const input = e.currentTarget.querySelector('input');
                if (input && input.showPicker) input.showPicker();
              }}>
                <div className="absolute inset-0 bg-slate-900/40 group-hover:bg-indigo-500/10 rounded-2xl transition-all border border-slate-800 group-hover:border-indigo-500/50"></div>
                <div className="relative flex items-center px-4 py-3 gap-4 bg-slate-800/20 rounded-2xl">
                  <div className="flex flex-col items-center">
                    <span className="text-xl font-black text-indigo-400 leading-none">{dayjs(selectedDay).format('DD')}</span>
                    <span className="text-[7px] font-black text-slate-500 uppercase tracking-tighter">{dayjs(selectedDay).format('MMM')}</span>
                  </div>
                  <div className="w-[1px] h-6 bg-slate-800"></div>
                  <div className="flex-1 min-w-[100px]">
                    <h4 className="text-[9px] font-black text-white uppercase tracking-widest leading-none">{dayjs(selectedDay).format('dddd')}</h4>
                  </div>
                  <Calendar className="text-slate-500 group-hover:text-indigo-400 transition-colors" size={16} />
                </div>
                <input 
                  type="date" 
                  value={selectedDay} 
                  onChange={(e) => setSelectedDay(e.target.value)} 
                  className="absolute inset-0 opacity-0 cursor-pointer" 
                />
              </div>
           </div>

           <div className="flex flex-col sm:flex-row items-center gap-8 lg:gap-12">
              <div className="flex flex-col items-center sm:items-end">
                 <span className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-1">Ventas Hoy</span>
                 <div className="flex items-center gap-3">
                    <h4 className="text-5xl font-black text-white tracking-tighter leading-none">{dailyStats.ventas}</h4>
                    <div className={`p-1.5 rounded-lg flex items-center justify-center ${dailyStats.comparativaVentas >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                       {dailyStats.comparativaVentas >= 0 ? <ArrowUpRight size={16}/> : <ArrowDownRight size={16}/>}
                       <span className="text-[10px] font-black ml-1">{Math.abs(dailyStats.comparativaVentas)}</span>
                    </div>
                 </div>
              </div>

              <div className="w-[1px] h-12 bg-slate-800 hidden sm:block"></div>

              <div className="w-full sm:w-auto bg-indigo-600/10 border border-indigo-500/20 p-5 pr-8 rounded-[30px] flex items-center gap-6 hover:bg-indigo-600/20 transition-all cursor-default">
                 <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 shadow-inner">
                    <TrendingUp size={24} />
                 </div>
                 <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase text-indigo-400 tracking-[0.2em] mb-1">Ganancia Hoy</span>
                    <h4 className="text-3xl font-black text-emerald-400 tracking-tighter leading-none">
                      ${dailyStats.ganancia.toLocaleString()}
                    </h4>
                 </div>
              </div>
           </div>
        </div>
      </div>

      {/* CONTENEDOR DE ACCIÓN Y RANKING */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ZONA DE ACCIÓN: VENCIMIENTOS DE HOY */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center gap-4">
             <div className="w-2 h-8 bg-amber-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(245,158,11,0.5)]"></div>
             <div className="flex flex-col">
                <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">Zona de Acción</h3>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Cuentas que vencen hoy {dayjs().format('DD MMM')}</p>
             </div>
          </div>

          {todayExpiries.length > 0 ? (
            <div className="space-y-4">
              {/* VISTA ESCRITORIO (TABLA) */}
              <div className="hidden sm:block bg-slate-900/40 border border-slate-800 rounded-[40px] overflow-hidden shadow-2xl">
                 <table className="w-full text-left">
                   <thead>
                     <tr className="border-b border-slate-800">
                        <th className="px-8 py-5 text-[9px] font-black uppercase text-slate-500 tracking-widest">Cliente</th>
                        <th className="px-8 py-5 text-[9px] font-black uppercase text-slate-500 tracking-widest">Plataforma</th>
                        <th className="px-8 py-5 text-[9px] font-black uppercase text-slate-500 tracking-widest text-center">Perfil</th>
                        <th className="px-8 py-5 text-[9px] font-black uppercase text-slate-500 tracking-widest text-right">Acciones</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-800/50">
                      {todayExpiries.map((sale, idx) => (
                        <tr key={idx} className="group hover:bg-slate-800/20 transition-all duration-300">
                          <td className="px-8 py-5">
                             <div className="flex flex-col gap-1">
                                <span className="text-[11px] font-black text-white uppercase">{sale.cliente}</span>
                                <span className="text-[8px] font-bold text-slate-500 uppercase">{sale.contacto}</span>
                             </div>
                          </td>
                          <td className="px-8 py-5">
                             <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-slate-800 p-1 flex items-center justify-center border border-slate-700">
                                   <img src={sale.plataformaImagenUrl} className="w-full h-full object-contain" alt="" />
                                </div>
                                <span className="text-[10px] font-black text-slate-300 uppercase">{sale.plataformaNombre}</span>
                             </div>
                          </td>
                          <td className="px-8 py-5 text-center">
                             <span className="px-3 py-1 bg-slate-950/50 border border-slate-800 rounded-lg text-[10px] font-mono text-slate-400">{sale.perfil || 'N/A'}</span>
                          </td>
                          <td className="px-8 py-5">
                             <div className="flex items-center justify-end gap-3">
                                <button onClick={() => handleWhatsAppReminder(sale)} className="p-2.5 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-xl transition-all" title="WhatsApp"><MessageCircle size={16}/></button>
                                <button onClick={() => handleOpenBulkRenovate([sale.id])} className="p-2.5 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white rounded-xl transition-all" title="Renovar"><RefreshCw size={16}/></button>
                             </div>
                          </td>
                        </tr>
                      ))}
                   </tbody>
                 </table>
              </div>

              {/* VISTA MÓVIL (CARDS) */}
              <div className="sm:hidden space-y-3">
                {todayExpiries.map((sale, idx) => (
                  <div key={idx} className="bg-slate-900/40 border border-slate-800 p-5 rounded-3xl flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-slate-800 p-1.5 flex items-center justify-center border border-slate-700 flex-shrink-0">
                        <img src={sale.plataformaImagenUrl} className="w-full h-full object-contain" alt="" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[11px] font-black text-white uppercase truncate">{sale.cliente}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest">{sale.plataformaNombre}</span>
                          <span className="px-1.5 py-0.5 bg-slate-950/50 rounded-md text-[7px] font-mono text-slate-500">{sale.perfil || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleWhatsAppReminder(sale)} className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl active:scale-95 transition-all"><MessageCircle size={16}/></button>
                      <button onClick={() => handleOpenBulkRenovate([sale.id])} className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl active:scale-95 transition-all"><RefreshCw size={16}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/20 border border-slate-800/50 rounded-[40px] p-8 sm:p-12 text-center border-dashed">
              <div className="inline-flex p-5 sm:p-6 bg-emerald-500/5 rounded-full text-emerald-500 mb-4 animate-bounce">
                <CheckCircle2 size={32} />
              </div>
              <p className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">¡Todo al día! No hay vencimientos para hoy.</p>
            </div>
          )}
        </div>

        {/* RANKING DE TENDENCIAS */}
        <div className="space-y-6">
          <div className="flex items-center gap-4">
             <div className="w-2 h-8 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
             <div className="flex flex-col">
                <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">Ranking Mensual</h3>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Tendencias de venta {monthFilter === 'Todos' ? 'del año' : 'de ' + monthFilter}</p>
             </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-[40px] shadow-2xl space-y-4">
            {platformRanking.length > 0 ? (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-indigo-500/20 hover:scrollbar-thumb-indigo-500/40">
                {platformRanking.map((item, idx) => (
                  <div key={item.name} className="group relative">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                         <div className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center text-[10px] font-black text-indigo-400 border border-slate-700">
                           {idx + 1}
                         </div>
                         <span className="text-[10px] font-black text-slate-300 uppercase tracking-tight">{item.name}</span>
                      </div>
                      <span className="text-[10px] font-black text-white tracking-tighter">{item.count} ventas</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                       <div 
                         className="h-full bg-indigo-600 rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(79,70,229,0.4)]"
                         style={{ width: `${(item.count / platformRanking[0].count) * 100}%` }}
                       ></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center space-y-3">
                <ShoppingCart size={24} className="text-slate-700 mx-auto" />
                <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest tracking-[0.2em]">Sin datos este mes</p>
              </div>
            )}
            
            <div className="pt-4 mt-4 border-t border-slate-800">
               <div className="flex items-center justify-between px-2">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Total Periodo</span>
                    <span className="text-sm font-black text-indigo-400 tracking-tighter">{platformRanking.reduce((acc, i) => acc + i.count, 0)} Unidades</span>
                  </div>
                  <Activity size={20} className="text-indigo-500/30" />
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* STATS BENTO GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
        <div className="relative group bg-slate-900/60 border border-slate-800 p-8 rounded-[45px] overflow-hidden hover:border-emerald-500/30 transition-all duration-500 shadow-2xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-[50px] -translate-y-1/2 translate-x-1/2"></div>
          <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.2em] mb-1">Utilidad General</p>
          <h4 className="text-4xl font-black text-white tracking-tighter">${stats.totalGanancia.toLocaleString()}</h4>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-8 rounded-[45px] hover:border-indigo-500/30 transition-all duration-500 shadow-2xl">
          <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.2em] mb-1">Volumen Global</p>
          <h4 className="text-4xl font-black text-white tracking-tighter">{stats.totalVentas} <span className="text-sm font-bold text-slate-700">uds</span></h4>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-8 rounded-[45px] hover:border-purple-500/30 transition-all duration-500 shadow-2xl">
          <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.2em] mb-1">Cuentas Clientes</p>
          <h4 className="text-4xl font-black text-white tracking-tighter">{stats.ventasFinal}</h4>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-8 rounded-[45px] hover:border-blue-500/30 transition-all duration-500 shadow-2xl">
          <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.2em] mb-1">Cuentas Distrib.</p>
          <h4 className="text-4xl font-black text-white tracking-tighter">{stats.ventasDistribuidor}</h4>
        </div>
      </div>

      {/* CHART SECTION 50/50 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="bg-slate-900 rounded-[50px] border border-slate-800 p-10 pb-12 shadow-3xl relative overflow-hidden flex flex-col h-[600px]">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-indigo-500"></div>
          <div className="flex flex-col items-center mb-10">
             <h3 className="text-xl font-black text-white uppercase tracking-[0.1em] text-center italic">Número de Cuentas Vendidas por Mes</h3>
             <div className="w-16 h-1 bg-slate-700 mt-3 rounded-full"></div>
          </div>
          
          <div className="h-full w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 40, right: 30, left: 20, bottom: 20 }} onMouseMove={handleChartMouseMove} onMouseLeave={handleChartMouseLeave}>
                <XAxis dataKey="name" stroke="#475569" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 900, fill: '#FFFFFF'}} dy={15}/>
                <YAxis hide domain={[0, 'auto']} />
                <Tooltip content={<CustomTooltip />} position={showTooltip ? tooltipPos : { x: -1000, y: -1000 }} isAnimationActive={false}/>
                <CartesianGrid stroke="#1e293b" vertical={true} horizontal={false} strokeDasharray="0" />
                <Line type="linear" dataKey="totalVentas" name="VENTAS" stroke="#FFFFFF" strokeWidth={4} dot={{ r: 6, fill: '#1e293b', stroke: '#FFFFFF', strokeWidth: 3 }} activeDot={{ r: 9, fill: '#FFFFFF', stroke: '#indigo-500', strokeWidth: 3 }} animationDuration={1500}>
                  <LabelList dataKey="totalVentas" position="top" offset={20} style={{ fill: '#FFFFFF', fontSize: '14px', fontWeight: '900', userSelect: 'none' }} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-900 rounded-[50px] border border-slate-800 p-10 shadow-3xl flex flex-col h-[600px]">
           <div className="flex items-center gap-4 mb-10">
              <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400 rotate-12"><Activity size={24}/></div>
              <h3 className="text-xl font-black text-white uppercase tracking-widest italic">Tendencia de Ingresos</h3>
           </div>
           <div className="h-full w-full">
             <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={data} margin={{ top: 40, right: 30, left: 30, bottom: 20 }} onMouseMove={handleChartMouseMove} onMouseLeave={handleChartMouseLeave}>
                  <defs><linearGradient id="colorGanancia" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient></defs>
                  <XAxis dataKey="name" stroke="#475569" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 900, fill: '#FFFFFF'}} dy={15}/>
                  <YAxis hide domain={[0, 'auto']} />
                  <Tooltip content={<CustomTooltip />} position={showTooltip ? tooltipPos : { x: -1000, y: -1000 }} isAnimationActive={false}/>
                  <Area type="linear" dataKey="ganancia" name="GANANCIA" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorGanancia)" />
               </AreaChart>
             </ResponsiveContainer>
           </div>
        </div>
      </div>
      {/* MODAL DE RENOVACIÓN (Portado de Sales.jsx) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md"></div>
          <div className="relative w-full max-w-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/20 rounded-[32px] border border-slate-800 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300 h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-7 py-5 border-b border-slate-800 shrink-0">
              <h3 className="text-xl font-black italic tracking-tighter uppercase text-white">Renovar / Venta</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-slate-800 rounded-2xl transition-all"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="px-7 py-5 space-y-6 overflow-y-auto scrollbar-hide flex-1">
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      <input required placeholder="Ej: Juan Pérez" value={formData.cliente} onChange={e => setFormData({...formData, cliente: e.target.value})} className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white font-black text-xs outline-none focus:ring-2 focus:ring-indigo-500/20" />
                    </div>
                  )}
                </div>

                <div className={`flex flex-col sm:flex-row ${formData.tipoCliente === 'Final' ? 'sm:gap-8' : 'sm:gap-0'} items-start transition-all duration-500`}>
                  <div className={`transition-all duration-500 ease-out overflow-hidden ${formData.tipoCliente === 'Final' ? 'w-full sm:w-1/2 opacity-100 translate-x-0' : 'w-0 h-0 opacity-0 -translate-x-10 pointer-events-none'}`}>
                    <div className="space-y-3 min-w-[200px]">
                      <label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest leading-none">WhatsApp</label>
                      <input required={formData.tipoCliente === 'Final'} placeholder="+57 300 000 0000" value={formData.contacto} onChange={e => setFormData({...formData, contacto: e.target.value})} className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white font-black text-xs outline-none focus:ring-2 focus:ring-indigo-500/20" />
                    </div>
                  </div>
                  <div className="w-full sm:w-1/2 space-y-3 transition-all duration-500 ease-out">
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

                <div className="flex flex-col sm:flex-row items-center gap-6 justify-between pt-4 border-t border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400"><ShoppingCart size={16}/></div>
                    <div className="flex flex-col">
                      <h4 className="text-xs font-black text-white uppercase italic tracking-tighter">Canasta de Plataformas</h4>
                    </div>
                  </div>
                  <button type="button" onClick={addItem} className="px-4 py-2 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-xl transition-all font-black text-[9px] uppercase tracking-widest border border-indigo-500/20 flex items-center gap-2">
                    <PlusCircle size={14} /> Añadir Cuenta
                  </button>
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
    </div>
  );
}
