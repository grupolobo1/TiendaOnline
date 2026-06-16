// ===================================================================================
// ARCHIVO: carrito.js — CON PRECIOS EN TIEMPO REAL DESDE BASEROW
// Los clientes siempre ven los precios actuales que la dueña edita en el admin.
// Paginación automática: trae TODOS los productos sin límite de 100.
// ===================================================================================

const BASEROW_TOKEN    = 'sTPlXBmAyDa2aZS1x78J8oYnb9oGOMe8';
const BASEROW_TABLE    = '1029851';
const BASEROW_URL_BASE = `https://api.baserow.io/api/database/rows/table/${BASEROW_TABLE}/?user_field_names=true&size=100`;

// -----------------------------------------------------------------------
// CACHÉ EN localStorage — 24 HORAS
// -----------------------------------------------------------------------
const CACHE_KEY    = 'baserow_precios';
const CACHE_TS_KEY = 'baserow_precios_ts';
const CACHE_TTL    = 0; // Sin caché — siempre datos frescos

// ------------------- PRECIOS DESDE BASEROW (CON PAGINACIÓN) -------------------

async function getPreciosDesdeBaserow() {
  const ahora      = Date.now();
  const tsGuardado = parseInt(localStorage.getItem(CACHE_TS_KEY) || '0', 10);
  const cacheVivo  = (ahora - tsGuardado) < CACHE_TTL;

  if (cacheVivo) {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // JSON corrupto — caemos al fetch
    }
  }

  // Caché expirado o vacío — pedimos a Baserow con paginación completa
  try {
    const lista = [];
    let url = BASEROW_URL_BASE;

    // Seguimos pidiendo páginas mientras Baserow devuelva un campo "next"
    while (url) {
      const res  = await fetch(url, {
        headers: { 'Authorization': `Token ${BASEROW_TOKEN}` }
      });
      const data = await res.json();
      if (Array.isArray(data.results)) lista.push(...data.results);
      url = data.next ? data.next.replace('http://', 'https://') : null; // forzar https
    }

    localStorage.setItem(CACHE_KEY,    JSON.stringify(lista));
    localStorage.setItem(CACHE_TS_KEY, String(ahora));

    return lista;
  } catch (e) {
    console.warn('No se pudo conectar con Baserow, usando caché anterior o vacío.', e);
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  }
}

// Limpia el caché manualmente
function limpiarCachePrecios() {
  localStorage.removeItem(CACHE_KEY);
  localStorage.removeItem(CACHE_TS_KEY);
  console.info('Caché de precios limpiado. Se pedirán nuevos datos en la próxima acción.');
}

// Busca un producto por su id_html
function encontrarFila(precios, id) {
  return precios.find(p => p.id_html === id) || null;
}

// Construye el mapa de ofertas por familia
function buildOfertasMap(precios) {
  const map = {};
  precios.forEach(p => {
    if (p.familia && p.precio_oferta && p.cantidad_minima) {
      if (!map[p.familia]) {
        map[p.familia] = {
          precioOferta:   parseFloat(p.precio_oferta)  || 0,
          cantidadMinima: parseInt(p.cantidad_minima)  || 1
        };
      }
    }
  });
  return map;
}

// ------------------- CARRITO -------------------

function getCartFromStorage() {
  try {
    const cart = JSON.parse(localStorage.getItem('miCarrito'));
    return Array.isArray(cart) ? cart : [];
  } catch {
    return [];
  }
}

function saveCartToStorage(cart) {
  localStorage.setItem('miCarrito', JSON.stringify(cart));
}

async function agregarAlCarrito(boton) {
  const productoDiv = boton.closest('[data-id]');
  if (!productoDiv) return;

  const id             = productoDiv.dataset.id;
  const nombre         = productoDiv.dataset.nombre;
  const precioOriginal = parseFloat(productoDiv.dataset.precio);
  const img            = productoDiv.querySelector('img');
  const imagen         = img ? img.src : '';
  const cantidadInput  = productoDiv.querySelector('.quantity-to-add');
  const cantidad       = parseInt(cantidadInput.value);

  if (isNaN(cantidad) || cantidad < 1) { alert('Cantidad inválida.'); return; }

  const precios = await getPreciosDesdeBaserow();
  const fila    = encontrarFila(precios, id);

  const precio         = fila ? (parseFloat(fila.precio)         || precioOriginal) : precioOriginal;
  const familia        = fila?.familia        || productoDiv.dataset.family  || null;
  const ofertaPrecio   = fila ? (parseFloat(fila.precio_oferta)  || null) : null;
  const ofertaCantidad = fila ? (parseInt(fila.cantidad_minima)  || null) : null;
  const nombrePaquete  = fila?.nombre_paquete || null;
  const precioPaquete  = fila ? (parseFloat(fila.precio_paquete) || null) : null;

  const carrito   = getCartFromStorage();
  const existente = carrito.find(item => item.id === id);
  if (existente) {
    existente.cantidad += cantidad;
    existente.precio    = precio;
  } else {
    carrito.push({ id, nombre, precio, cantidad, familia, ofertaPrecio, ofertaCantidad, nombrePaquete, precioPaquete, imagen });
  }

  cantidadInput.value = 1;
  saveCartToStorage(carrito);
  actualizarContadorUI();
}

async function agregarAlCarritoSimple(id, nombre, precioOriginal, imagen) {
  const precios = await getPreciosDesdeBaserow();
  const fila    = encontrarFila(precios, id);
  const precio  = fila ? (parseFloat(fila.precio) || precioOriginal) : precioOriginal;
  const familia = fila?.familia || null;

  const carrito   = getCartFromStorage();
  const existente = carrito.find(item => item.id === id);
  if (existente) {
    existente.cantidad++;
    existente.precio = precio;
  } else {
    carrito.push({ id, nombre, precio, cantidad: 1, familia, imagen });
  }

  saveCartToStorage(carrito);
  actualizarContadorUI();
}

function modificarCantidad(id, cambio) {
  let carrito = getCartFromStorage();
  const prod  = carrito.find(item => item.id === id);
  if (prod) prod.cantidad += cambio;
  carrito = carrito.filter(item => item.cantidad > 0);
  saveCartToStorage(carrito);
  dibujarCarritoCompleto();
}

function eliminarDelCarrito(id) {
  saveCartToStorage(getCartFromStorage().filter(item => item.id !== id));
  dibujarCarritoCompleto();
}

function actualizarContadorUI() {
  const contador = document.getElementById('contador-carrito');
  if (contador) {
    contador.innerText = getCartFromStorage().reduce((s, i) => s + (i.cantidad || 0), 0);
  }
}

async function dibujarCarritoCompleto() {
  const carritoItemsDiv = document.getElementById('carrito-items');
  const carritoTotalDiv = document.getElementById('carrito-total');
  if (!carritoItemsDiv) return;

  carritoItemsDiv.innerHTML = '<p class="text-gray-400 text-sm text-center py-4">⏳ Cargando precios actualizados...</p>';

  const carrito = getCartFromStorage();
  const precios = await getPreciosDesdeBaserow();
  const OFERTAS = buildOfertasMap(precios);

  carritoItemsDiv.innerHTML = '';
  let totalGeneral = 0;

  if (carrito.length === 0) {
    carritoItemsDiv.innerHTML = '<p class="text-gray-500">Tu carrito está vacío.</p>';
  } else {
    const cantFamilia = {};
    carrito.forEach(item => {
      const fila    = encontrarFila(precios, item.id);
      const familia = fila?.familia || item.familia;
      if (familia) cantFamilia[familia] = (cantFamilia[familia] || 0) + item.cantidad;
    });

    carrito.forEach(item => {
      if (!item || !item.nombre || item.precio == null || item.cantidad == null) return;

      const fila    = encontrarFila(precios, item.id);
      const familia = fila?.familia || item.familia;
      let precioUnitario = fila ? (parseFloat(fila.precio) || item.precio) : item.precio;
      let notaPrecio = '';

      // Datos paquete actualizados desde Baserow
      const nombrePaquete = fila?.nombre_paquete || item.nombrePaquete || null;
      const precioPaquete = fila ? (parseFloat(fila.precio_paquete) || null) : (item.precioPaquete || null);

      if (familia && OFERTAS[familia] && (cantFamilia[familia] || 0) >= OFERTAS[familia].cantidadMinima) {
        precioUnitario = OFERTAS[familia].precioOferta;
        notaPrecio = ` <span class="text-xs text-blue-500">(Oferta Familia)</span>`;
      } else if (item.ofertaPrecio && item.ofertaCantidad && item.cantidad >= item.ofertaCantidad) {
        precioUnitario = item.ofertaPrecio;
        notaPrecio = ` <span class="text-xs text-blue-500">(Oferta)</span>`;
      }

      const subtotal = precioUnitario * item.cantidad;
      totalGeneral  += subtotal;

      carritoItemsDiv.innerHTML += `
        <div class="flex items-center gap-3 mb-3">
          <img src="${item.imagen}" class="w-16 h-16 object-cover rounded-lg border" alt="${item.nombre}">
          <div class="flex-grow pr-2">
            <p class="font-semibold">${item.nombre}${notaPrecio}</p>
            <p class="text-sm text-gray-600">$${subtotal.toFixed(2)} (${item.cantidad} x $${precioUnitario.toFixed(2)})</p>
            ${(nombrePaquete && precioPaquete) ? `<p class="text-xs text-blue-600 mt-0.5">📦 ${nombrePaquete}: <strong>$${precioPaquete.toFixed(2)}</strong></p>` : ''}
          </div>
          <div class="flex items-center flex-shrink-0">
            <button onclick="modificarCantidad('${item.id}', -1)" class="bg-gray-200 w-7 h-7 rounded-full font-bold flex items-center justify-center">-</button>
            <span class="w-8 text-center font-semibold">${item.cantidad}</span>
            <button onclick="modificarCantidad('${item.id}', 1)" class="bg-gray-200 w-7 h-7 rounded-full font-bold flex items-center justify-center">+</button>
            <button onclick="eliminarDelCarrito('${item.id}')" class="text-red-500 hover:text-red-700 ml-3 text-xl">🗑️</button>
          </div>
        </div>`;
    });
  }

  if (carritoTotalDiv) carritoTotalDiv.innerText = `Total: $${totalGeneral.toFixed(2)}`;
  actualizarContadorUI();
}

function mostrarCarrito() {
  const modal = document.getElementById('modal-carrito');
  if (!modal) return;
  modal.classList.remove('hidden');
  dibujarCarritoCompleto().catch(err => {
    console.error('Error al dibujar carrito:', err);
    const div = document.getElementById('carrito-items');
    if (div) div.innerHTML = '<p class="text-red-500 font-bold">Error al cargar. Por favor recarga la página.</p>';
  });
}

function ocultarCarrito() {
  document.getElementById('modal-carrito').classList.add('hidden');
}

async function enviarPedido() {
  const carrito = getCartFromStorage();
  if (carrito.length === 0) { alert('Tu carrito está vacío.'); return; }

  const precios = await getPreciosDesdeBaserow();
  const OFERTAS = buildOfertasMap(precios);

  const cantFamilia = {};
  carrito.forEach(item => {
    const fila = encontrarFila(precios, item.id);
    const fam  = fila?.familia || item.familia;
    if (fam) cantFamilia[fam] = (cantFamilia[fam] || 0) + item.cantidad;
  });

  let resumenHTML  = '';
  let totalGeneral = 0;

  carrito.forEach(item => {
    const fila    = encontrarFila(precios, item.id);
    const familia = fila?.familia || item.familia;
    let precioUnitario = fila ? (parseFloat(fila.precio) || item.precio) : item.precio;

    if (familia && OFERTAS[familia] && (cantFamilia[familia] || 0) >= OFERTAS[familia].cantidadMinima) {
      precioUnitario = OFERTAS[familia].precioOferta;
    } else if (item.ofertaPrecio && item.ofertaCantidad && item.cantidad >= item.ofertaCantidad) {
      precioUnitario = item.ofertaPrecio;
    }

    const subtotal = precioUnitario * item.cantidad;
    totalGeneral  += subtotal;
    resumenHTML   += `
      <div class="flex justify-between border-b py-1">
        <span>${item.nombre} x${item.cantidad}</span>
        <span class="font-semibold">$${subtotal.toFixed(2)}</span>
      </div>`;
  });

  resumenHTML += `
    <div class="flex justify-between pt-3 text-lg font-bold">
      <span>Total</span><span>$${totalGeneral.toFixed(2)}</span>
    </div>`;

  document.getElementById('resumen-confirmacion').innerHTML = resumenHTML;
  document.getElementById('modal-confirmacion').classList.remove('hidden');
}

function cancelarConfirmacion() {
  document.getElementById('modal-confirmacion').classList.add('hidden');
}

async function confirmarEnvio() {
  const carrito = getCartFromStorage();
  const precios = await getPreciosDesdeBaserow();
  const OFERTAS = buildOfertasMap(precios);

  const cantFamilia = {};
  carrito.forEach(item => {
    const fila = encontrarFila(precios, item.id);
    const fam  = fila?.familia || item.familia;
    if (fam) cantFamilia[fam] = (cantFamilia[fam] || 0) + item.cantidad;
  });

  const numero = localStorage.getItem('admin_whatsapp') || '2482000310';

  let mensaje      = `*Resumen de Pedido:* 🛒\n\n*Productos:*\n`;
  let totalGeneral = 0;

  carrito.forEach(item => {
    const fila    = encontrarFila(precios, item.id);
    const familia = fila?.familia || item.familia;
    let precioUnitario = fila ? (parseFloat(fila.precio) || item.precio) : item.precio;

    if (familia && OFERTAS[familia] && (cantFamilia[familia] || 0) >= OFERTAS[familia].cantidadMinima) {
      precioUnitario = OFERTAS[familia].precioOferta;
    } else if (item.ofertaPrecio && item.ofertaCantidad && item.cantidad >= item.ofertaCantidad) {
      precioUnitario = item.ofertaPrecio;
    }

    const subtotal = precioUnitario * item.cantidad;
    mensaje       += `• ${item.nombre} (${item.cantidad} x $${precioUnitario.toFixed(2)}) = *$${subtotal.toFixed(2)}*\n`;
    totalGeneral  += subtotal;
  });

  mensaje += `--------------------\n*TOTAL: $${totalGeneral.toFixed(2)}*\n\n¡Gracias por tu compra!`;

  window.open(`https://api.whatsapp.com/send?phone=${numero}&text=${encodeURIComponent(mensaje)}`, '_blank');

  localStorage.removeItem('miCarrito');
  document.getElementById('modal-confirmacion').classList.add('hidden');
  ocultarCarrito();
  actualizarContadorUI();
  setTimeout(() => location.reload(), 400);
}
// -----------------------------------------------------------------------
// ACTUALIZAR PRECIOS VISIBLES EN LA PÁGINA AL CARGAR
// -----------------------------------------------------------------------
async function actualizarPreciosEnPagina() {
  try {
    const precios = await getPreciosDesdeBaserow();
    if (!precios || precios.length === 0) return;

    document.querySelectorAll('[data-id]').forEach(el => {
      const id   = el.dataset.id;
      const fila = precios.find(p => p.id_html === id);
      if (!fila) return;

      const precioNuevo  = parseFloat(fila.precio);
      const ofertaNuevo  = parseFloat(fila.precio_oferta) || null;
      const cantMinNueva = parseInt(fila.cantidad_minima)  || null;

      if (!isNaN(precioNuevo))  el.dataset.precio         = precioNuevo;
      if (ofertaNuevo)          el.dataset.ofertaPrecio   = ofertaNuevo;
      if (cantMinNueva)         el.dataset.ofertaCantidad = cantMinNueva;

      const pNormal = el.querySelector('p.text-sm.text-gray-600');
      if (pNormal && !isNaN(precioNuevo)) {
        const sufijo = pNormal.textContent.replace(/\$[\d.,]+/, '').trim();
        pNormal.textContent = '$' + precioNuevo.toFixed(2) + (sufijo ? ' ' + sufijo : '');
      }

      if (ofertaNuevo && cantMinNueva) {
        const pOferta = el.querySelector('p.text-xs.text-blue-600');
        if (pOferta) {
          pOferta.textContent = 'A partir de ' + cantMinNueva + ' a $' + ofertaNuevo.toFixed(2) + ' c/u';
        }
      }

      // Stock y disponibilidad
      var stock       = parseInt(fila.stock) || 0;
      var disponible  = (fila.disponible === true || fila.disponible === 'true');
      var agotado     = !disponible || stock === 0;
      var pocoStock   = disponible && stock > 0 && stock <= 5;

      // Quitar badge anterior si existe
      var badgeViejo = el.querySelector('.stock-badge');
      if (badgeViejo) badgeViejo.remove();

      var infoDiv2 = el.querySelector('.flex-grow');

      if (agotado) {
        // Atenuar producto completo
        el.style.opacity = '0.5';
        el.style.pointerEvents = 'none';
        // Badge rojo "Sin stock"
        if (infoDiv2) {
          var badge = document.createElement('p');
          badge.className = 'stock-badge';
          badge.style.cssText = 'font-size:11px;font-weight:700;color:#fff;background:#dc2626;display:inline-block;padding:2px 8px;border-radius:999px;margin-top:4px;';
          badge.textContent = '❌ Agotado';
          infoDiv2.appendChild(badge);
        }
      } else {
        // Restaurar por si antes estaba agotado
        el.style.opacity = '';
        el.style.pointerEvents = '';
        if (pocoStock) {
          // Badge naranja "¡Solo quedan X!"
          if (infoDiv2) {
            var badgePoco = document.createElement('p');
            badgePoco.className = 'stock-badge';
            badgePoco.style.cssText = 'font-size:11px;font-weight:700;color:#fff;background:#ea580c;display:inline-block;padding:2px 8px;border-radius:999px;margin-top:4px;';
            badgePoco.textContent = '⚠️ ¡Solo quedan ' + stock + '!';
            infoDiv2.appendChild(badgePoco);
          }
        }
      }

      // Boton de paquete dinamico
      var nombrePaq = fila.nombre_paquete || null;
      var precioPaq = parseFloat(fila.precio_paquete) || null;
      if (nombrePaq && precioPaq) {
        if (!el.querySelector('.paquete-btn-row')) {
          var idHtml   = fila.id_html || el.dataset.id;
          var imgEl    = el.querySelector('img');
          var imgSrc   = imgEl ? imgEl.src : '';
          var palabraBtn = nombrePaq.split(' ')[0];
          var row = document.createElement('div');
          row.className = 'paquete-btn-row';
          row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:8px 12px;margin-top:8px;gap:8px;';
          var label = document.createElement('p');
          label.style.cssText = 'font-size:12px;color:#1e40af;font-weight:700;margin:0;';
          label.textContent = '📦 ' + nombrePaq + ': $' + precioPaq.toFixed(2);
          var btn = document.createElement('button');
          btn.style.cssText = 'flex-shrink:0;background:#1d4ed8;color:#fff;font-size:11px;font-weight:700;padding:6px 12px;border-radius:8px;border:none;cursor:pointer;';
          btn.textContent = 'AGREGAR ' + palabraBtn;
          btn.setAttribute('data-id-paq', idHtml);
          btn.setAttribute('data-nombre-paq', fila.nombre || el.dataset.nombre || '');
          btn.setAttribute('data-precio-paq', precioPaq);
          btn.setAttribute('data-img-paq', imgSrc);
          btn.setAttribute('data-label-paq', nombrePaq);
          btn.onclick = function() {
            var b = this;
            agregarPaqueteAlCarrito(
              b.getAttribute('data-id-paq'),
              b.getAttribute('data-nombre-paq'),
              parseFloat(b.getAttribute('data-precio-paq')),
              b.getAttribute('data-img-paq'),
              b.getAttribute('data-label-paq')
            );
            var orig = b.textContent;
            b.textContent = '✓ Agregado';
            b.style.background = '#16a34a';
            setTimeout(function() {
              b.textContent = orig;
              b.style.background = '#1d4ed8';
            }, 1200);
          };
          row.appendChild(label);
          row.appendChild(btn);
          var infoDiv = el.querySelector('.flex-grow');
          if (infoDiv) infoDiv.appendChild(row);
        }
      }
    });
  } catch (e) {
    console.warn('actualizarPreciosEnPagina error:', e);
  }
}

document.addEventListener('DOMContentLoaded', function () {
  actualizarContadorUI();
  actualizarPreciosEnPagina();
});

// Agrega paquete al carrito
async function agregarPaqueteAlCarrito(id, nombre, precio, imagen, nombrePaquete) {
  var precios  = await getPreciosDesdeBaserow();
  var fila     = encontrarFila(precios, id);
  var carrito  = getCartFromStorage();
  var idPaq    = id + '-paq';
  var existente = carrito.find(function(item) { return item.id === idPaq; });
  var precioFinal = fila ? (parseFloat(fila.precio_paquete) || precio) : precio;

  if (existente) {
    existente.cantidad++;
    existente.precio = precioFinal;
  } else {
    carrito.push({
      id: idPaq,
      nombre: nombrePaquete + ' — ' + nombre,
      precio: precioFinal,
      cantidad: 1,
      familia: null,
      imagen: imagen
    });
  }
  saveCartToStorage(carrito);
  actualizarContadorUI();
}
