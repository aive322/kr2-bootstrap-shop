// Небольшой скрипт для форм: Bootstrap-валидация и сообщение об успехе.
// Страницы работают и без него, он только добавляет обратную связь.

document.addEventListener('DOMContentLoaded', function () {
  // 1. Модальное окно: подставляем название выбранного товара
  var modalElement = document.getElementById('orderModal');
  var modalForm = document.getElementById('modalForm');
  var modalProduct = document.getElementById('modalProduct');
  var modalSuccess = document.getElementById('modalSuccess');

  if (modalElement) {
    modalElement.addEventListener('show.bs.modal', function (event) {
      var button = event.relatedTarget;
      var product = button ? button.getAttribute('data-product') : null;
      modalProduct.textContent = product || 'не выбран';
      modalForm.classList.remove('was-validated');
      modalForm.reset();
      modalSuccess.classList.add('d-none');
    });

    modalForm.addEventListener('submit', function (event) {
      event.preventDefault();
      modalForm.classList.add('was-validated');
      if (!modalForm.checkValidity()) {
        return;
      }
      modalSuccess.classList.remove('d-none');
      modalForm.classList.remove('was-validated');
    });
  }

  // 2. Страница заявки
  var orderForm = document.getElementById('orderForm');
  var orderSuccess = document.getElementById('orderSuccess');

  if (orderForm) {
    orderForm.addEventListener('submit', function (event) {
      event.preventDefault();
      orderForm.classList.add('was-validated');
      if (!orderForm.checkValidity()) {
        orderSuccess.classList.add('d-none');
        return;
      }
      orderForm.reset();
      orderForm.classList.remove('was-validated');
      orderSuccess.classList.remove('d-none');
    });

    orderForm.addEventListener('reset', function () {
      orderForm.classList.remove('was-validated');
      orderSuccess.classList.add('d-none');
    });
  }
});
