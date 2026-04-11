/**
 * SCRIPT DE MIGRACIÓN: Recalcula fechaCompra para todos los registros de ventas
 * 
 * Fórmula: fechaCompra = fechaVencimiento - vigenciaDias (de la plataforma)
 * 
 * Cómo ejecutar:
 *   node scripts/migrate-fechaCompra.mjs
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import dayjs from 'dayjs';

const firebaseConfig = {
  apiKey: "AIzaSyAc12-NNlk3IaCBlRoOuLOGMJJQGIkmGpQ",
  authDomain: "streaming-admin-45c51.firebaseapp.com",
  projectId: "streaming-admin-45c51",
  storageBucket: "streaming-admin-45c51.firebasestorage.app",
  messagingSenderId: "341650375058",
  appId: "1:341650375058:web:b74407a3ce13f29e42c14b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrateFechaCompra() {
  console.log('🚀 Iniciando migración de fechaCompra...\n');

  // 1. Cargar todas las plataformas
  console.log('📦 Cargando plataformas...');
  const platsSnap = await getDocs(collection(db, 'plataformas'));
  const platforms = {};
  platsSnap.docs.forEach(d => {
    platforms[d.id] = d.data();
  });
  console.log(`   ${Object.keys(platforms).length} plataformas cargadas.\n`);

  // 2. Cargar todas las ventas
  console.log('📋 Cargando ventas...');
  const ventasSnap = await getDocs(collection(db, 'ventas'));
  const ventas = ventasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`   ${ventas.length} ventas encontradas.\n`);

  // 3. Recalcular y actualizar
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const venta of ventas) {
    try {
      const platform = platforms[venta.plataformaId];

      if (!platform) {
        console.warn(`  ⚠️  Plataforma no encontrada para venta ${venta.id} (${venta.cliente})`);
        skipped++;
        continue;
      }

      const vigenciaDias = Number(platform.vigenciaDias) || 30;
      const fechaVencimiento = venta.fechaVencimiento?.seconds
        ? dayjs(venta.fechaVencimiento.toDate?.() ?? new Date(venta.fechaVencimiento.seconds * 1000))
        : dayjs(venta.fechaVencimiento);

      if (!fechaVencimiento.isValid()) {
        console.warn(`  ⚠️  fechaVencimiento inválida en venta ${venta.id}`);
        skipped++;
        continue;
      }

      const nuevaFechaCompra = fechaVencimiento.subtract(vigenciaDias, 'day').toISOString();
      const mesRegistroNuevo = fechaVencimiento.subtract(vigenciaDias, 'day').format('MMMM YYYY');

      await updateDoc(doc(db, 'ventas', venta.id), {
        fechaCompra: nuevaFechaCompra,
        mesRegistro: mesRegistroNuevo
      });

      console.log(`  ✅ ${venta.cliente} | ${venta.plataformaNombre} | Inicio: ${dayjs(nuevaFechaCompra).format('DD MMM YYYY')} → Vence: ${fechaVencimiento.format('DD MMM YYYY')}`);
      updated++;
    } catch (err) {
      console.error(`  ❌ Error en venta ${venta.id}:`, err.message);
      errors++;
    }
  }

  console.log('\n========================================');
  console.log(`✅ Actualizados: ${updated}`);
  console.log(`⏭️  Omitidos:    ${skipped}`);
  console.log(`❌ Errores:      ${errors}`);
  console.log('========================================');
  console.log('🎉 Migración completada.\n');

  process.exit(0);
}

migrateFechaCompra().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
