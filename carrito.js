// ===================================================================================
// ARCHIVO: carrito.js (VERSIÓN FINAL Y A PRUEBA DE ERRORES)
// Corregido para manejar datos corruptos y funcionar en todas las páginas.
// ===================================================================================

// ------------------- CONFIGURACIÓN -------------------
const tuNumeroDeWhatsApp = '2482000310'; // ⚠️ Reemplaza con tu número

const OFERTAS_POR_FAMILIA = {
  'pall-mall': { precioNormal: 95.00, precioOferta: 9.00, cantidadMinima: 5 },
  'marlboro-rojo': { precioNormal: 101.00, precioOferta: 96.00, cantidadMinima: 5 },
  'marlboro-vista': { precioNormal: 94.00, precioOferta: 86.00, cantidadMinima: 5 }
};

// ------------------- LÓGICA DEL CARRITO -------------------

function getCartFromStorage() {
  try {
    const cart = JSON.parse(localStorage.getItem('miCarrito'));
    return Array.isArray(cart) ? cart : [];
  } catch (error) {
    console.error("Error al leer el carrito, se reiniciará.", error);
    return []; // Devuelve un carrito vacío si los datos están corruptos
  }
}

function saveCartToStorage(cart) {
  localStorage.setItem('miCarrito', JSON.stringify(cart));
}

function agregarAlCarrito(boton) {
  const productoDiv = boton.closest('[data-id]');
  if (!productoDiv) return;

  const id = productoDiv.dataset.id;
  const nombre = productoDiv.dataset.nombre;
  const precio = parseFloat(productoDiv.dataset.precio);
  const familia = productoDiv.dataset.family || null;
  const ofertaPrecio = parseFloat(productoDiv.dataset.ofertaPrecio) || null;
  const ofertaCantidad = parseInt(productoDiv.dataset.ofertaCantidad) || null;

  const img = productoDiv.querySelector('img');
  const imagen = img ? img.src : '';

  const cantidadInput = productoDiv.querySelector('.quantity-to-add');
  const cantidad = parseInt(cantidadInput.value);

  if (isNaN(cantidad) || cantidad < 1) {
    alert("Cantidad inválida.");
    return;
  }

  const carrito = getCartFromStorage();
  const productoEnCarrito = carrito.find(item => item.id === id);

  if (productoEnCarrito) {
    productoEnCarrito.cantidad += cantidad;
  } else {
    carrito.push({
      id,
      nombre,
      precio,
      cantidad,
      familia,
      ofertaPrecio,
      ofertaCantidad,
      imagen
    });
  }

  cantidadInput.value = 1;
  saveCartToStorage(carrito);
  actualizarContadorUI();
}

// Añadimos "imagen" a los parámetros
function agregarAlCarritoSimple(id, nombre, precio, imagen) {
    const carrito = getCartFromStorage();
    const productoEnCarrito = carrito.find(item => item.id === id);
    
    if (productoEnCarrito) {
        productoEnCarrito.cantidad++;
    } else {
        // Guardamos la imagen dentro del objeto del carrito
        carrito.push({ 
            id, 
            nombre, 
            precio, 
            cantidad: 1, 
            familia: null,
            imagen: imagen // <--- Esta es la clave
        });
    }
    
    saveCartToStorage(carrito);
    actualizarContadorUI();
    
    // Opcional: Si tienes una función para abrir el carrito o mostrar un aviso
    // mostrarNotificacion(`${nombre} agregado`); 
}
function modificarCantidad(id, cambio) {
  let carrito = getCartFromStorage();
  const productoEnCarrito = carrito.find(item => item.id === id);
  if (productoEnCarrito) {
    productoEnCarrito.cantidad += cambio;
  }
  carrito = carrito.filter(item => item.cantidad > 0);
  saveCartToStorage(carrito);
  dibujarCarritoCompleto();
}

function eliminarDelCarrito(id) {
  let carrito = getCartFromStorage();
  carrito = carrito.filter(item => item.id !== id);
  saveCartToStorage(carrito);
  dibujarCarritoCompleto();
}

function actualizarContadorUI() {
    const carrito = getCartFromStorage();
    const contadorCarrito = document.getElementById('contador-carrito');
    if (contadorCarrito) {
        const totalItems = carrito.reduce((sum, item) => sum + (item.cantidad || 0), 0);
        contadorCarrito.innerText = totalItems;
    }
}

function dibujarCarritoCompleto() {
  const carritoItemsDiv = document.getElementById('carrito-items');
  const carritoTotalDiv = document.getElementById('carrito-total');
  const carrito = getCartFromStorage();
  
  if (!carritoItemsDiv) return;

  carritoItemsDiv.innerHTML = '';
  let totalGeneral = 0;

  if (carrito.length === 0) {
    carritoItemsDiv.innerHTML = '<p class="text-gray-500">Tu carrito está vacío.</p>';
  } else {
    const cantidadesPorFamilia = {};
    for (const familia in OFERTAS_POR_FAMILIA) {
        cantidadesPorFamilia[familia] = carrito.filter(item => item.familia === familia).reduce((sum, item) => sum + item.cantidad, 0);
    }
    carrito.forEach(item => {
      // SALVAGUARDA: Si un item está corrupto, lo ignoramos para no romper la app.
      if (!item || typeof item.nombre === 'undefined' || typeof item.precio === 'undefined' || typeof item.cantidad === 'undefined') {
        console.warn("Se encontró un item corrupto en el carrito y fue ignorado:", item);
        return; 
      }

      let precioUnitario = item.precio;
      let notaPrecio = "";
      
      if (item.familia && OFERTAS_POR_FAMILIA[item.familia]) {
        const oferta = OFERTAS_POR_FAMILIA[item.familia];
        if (cantidadesPorFamilia[item.familia] >= oferta.cantidadMinima) {
          precioUnitario = oferta.precioOferta;
          notaPrecio = ` <span class="text-xs text-blue-500">(Oferta Familia)</span>`;
        }
      } else if (item.ofertaPrecio && item.ofertaCantidad && item.cantidad >= item.ofertaCantidad) {
        precioUnitario = item.ofertaPrecio;
        notaPrecio = ` <span class="text-xs text-blue-500">(Oferta)</span>`;
      }

      const subtotal = precioUnitario * item.cantidad;
      totalGeneral += subtotal;

    const itemHtml = `
  <div class="flex items-center gap-3 mb-3">
    
    <img src="${item.imagen}" class="w-16 h-16 object-cover rounded-lg border" alt="${item.nombre}">

    <div class="flex-grow pr-2">
      <p class="font-semibold">${item.nombre}${notaPrecio}</p>
      <p class="text-sm text-gray-600">$${subtotal.toFixed(2)} (${item.cantidad} x $${precioUnitario.toFixed(2)})</p>
    </div>

    <div class="flex items-center flex-shrink-0">
      <button onclick="modificarCantidad('${item.id}', -1)" class="bg-gray-200 w-7 h-7 rounded-full font-bold flex items-center justify-center">-</button>
      <span class="w-8 text-center font-semibold">${item.cantidad}</span>
      <button onclick="modificarCantidad('${item.id}', 1)" class="bg-gray-200 w-7 h-7 rounded-full font-bold flex items-center justify-center">+</button>
      <button onclick="eliminarDelCarrito('${item.id}')" class="text-red-500 hover:text-red-700 ml-3 text-xl">🗑️</button>
    </div>
    
  </div>
`;

      carritoItemsDiv.innerHTML += itemHtml;
    });
  }
  
  if (carritoTotalDiv) carritoTotalDiv.innerText = `Total: $${totalGeneral.toFixed(2)}`;
  actualizarContadorUI();
}

// ========= FUNCIÓN CLAVE A PRUEBA DE ERRORES =========
function mostrarCarrito() {
  const modal = document.getElementById('modal-carrito');
  if (!modal) return;
  
  try {
    dibujarCarritoCompleto();
  } catch (error) {
    console.error("¡ERROR CRÍTICO AL DIBUJAR EL CARRITO!", error);
    const carritoItemsDiv = document.getElementById('carrito-items');
    if(carritoItemsDiv) {
        carritoItemsDiv.innerHTML = '<p class="text-red-500 font-bold">Hubo un error al cargar los productos. Por favor, recargue la página.</p>';
    }
  }

  // PASE LO QUE PASE, nos aseguramos de que el modal se muestre
  modal.classList.remove('hidden');
}

function ocultarCarrito() {
  document.getElementById('modal-carrito').classList.add('hidden');
}

function enviarPedido() {
    const carrito = getCartFromStorage();

    if (carrito.length === 0) {
        alert('Tu carrito está vacío.');
        return;
    }

    let resumenHTML = '';
    let totalGeneral = 0;

    carrito.forEach(item => {
        let precioUnitario = item.precio;

        if (item.familia && OFERTAS_POR_FAMILIA[item.familia]) {
            const oferta = OFERTAS_POR_FAMILIA[item.familia];
            const totalEnFamilia = carrito
                .filter(p => p.familia === item.familia)
                .reduce((sum, p) => sum + p.cantidad, 0);

            if (totalEnFamilia >= oferta.cantidadMinima) {
                precioUnitario = oferta.precioOferta;
            }
        } else if (item.ofertaPrecio && item.ofertaCantidad && item.cantidad >= item.ofertaCantidad) {
            precioUnitario = item.ofertaPrecio;
        }

        const subtotal = precioUnitario * item.cantidad;
        totalGeneral += subtotal;

        resumenHTML += `
          <div class="flex justify-between border-b py-1">
            <span>${item.nombre} x${item.cantidad}</span>
            <span class="font-semibold">$${subtotal.toFixed(2)}</span>
          </div>
        `;
    });

    resumenHTML += `
      <div class="flex justify-between pt-3 text-lg font-bold">
        <span>Total</span>
        <span>$${totalGeneral.toFixed(2)}</span>
      </div>
    `;

    document.getElementById('resumen-confirmacion').innerHTML = resumenHTML;
    document.getElementById('modal-confirmacion').classList.remove('hidden');
}
function cancelarConfirmacion() {
    document.getElementById('modal-confirmacion').classList.add('hidden');
}

function confirmarEnvio() {
    const carrito = getCartFromStorage();

    let mensaje = `*Resumen de Pedido:* 🛒\n\n*Productos:*\n`;
    let totalGeneral = 0;

    carrito.forEach(item => {
        let precioUnitario = item.precio;

        if (item.familia && OFERTAS_POR_FAMILIA[item.familia]) {
            const oferta = OFERTAS_POR_FAMILIA[item.familia];
            const totalEnFamilia = carrito
                .filter(p => p.familia === item.familia)
                .reduce((sum, p) => sum + p.cantidad, 0);

            if (totalEnFamilia >= oferta.cantidadMinima) {
                precioUnitario = oferta.precioOferta;
            }
        } else if (item.ofertaPrecio && item.ofertaCantidad && item.cantidad >= item.ofertaCantidad) {
            precioUnitario = item.ofertaPrecio;
        }

        const subtotal = precioUnitario * item.cantidad;
        mensaje += `• ${item.nombre} (${item.cantidad} x $${precioUnitario.toFixed(2)}) = *$${subtotal.toFixed(2)}*\n`;
        totalGeneral += subtotal;
    });

    mensaje += `--------------------\n*TOTAL: $${totalGeneral.toFixed(2)}*\n\n¡Gracias por tu compra!`;

    const urlWhatsApp = `https://api.whatsapp.com/send?phone=${tuNumeroDeWhatsApp}&text=${encodeURIComponent(mensaje)}`;

    window.open(urlWhatsApp, '_blank');

    localStorage.removeItem('miCarrito');
    document.getElementById('modal-confirmacion').classList.add('hidden');
    ocultarCarrito();
    actualizarContadorUI();

    setTimeout(() => location.reload(), 400);
}
