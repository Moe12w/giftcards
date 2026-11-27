/* global window */
(function () {
  'use strict';

  var registry = window.wc && window.wc.wcBlocksRegistry;
  var element = window.wp && window.wp.element;
  var i18n = window.wp && window.wp.i18n;
  var settingsStore = window.wc && window.wc.wcSettings;

  if (!registry || !element || !settingsStore || !registry.registerPaymentMethod) return;

  var createElement = element.createElement;
  var useEffect = element.useEffect;
  var useState = element.useState;
  var __ = i18n ? i18n.__ : function (text) { return text; };

  var data = settingsStore.getSetting('tazella_gift_cards_data', {}) || {};
  var title = data.title || 'Tazella gift card';
  var description = data.description || __('Pay with a Tazella gift card.', 'tazella-gift-cards');

  function Label() {
    return createElement('span', null, title);
  }

  function Content(props) {
    var eventRegistration = props.eventRegistration || {};
    var emitResponse = props.emitResponse || {};
    var onPaymentProcessing = eventRegistration.onPaymentProcessing;
    var onCheckoutValidation = eventRegistration.onCheckoutValidation;

    var cardCodeState = useState('');
    var cardCode = cardCodeState[0];
    var setCardCode = cardCodeState[1];

    var errorState = useState('');
    var error = errorState[0];
    var setError = errorState[1];

    // Blocks: the code travels as checkout payment_data. It is read by
    // woocommerce_store_api_checkout_update_order_from_request server-side.
    useEffect(function () {
      if (typeof onPaymentProcessing !== 'function') return undefined;
      return onPaymentProcessing(function () {
        return {
          type: emitResponse.responseTypes
            ? emitResponse.responseTypes.SUCCESS
            : 'success',
          meta: { paymentMethodData: { tazella_card_code: cardCode } },
        };
      });
    }, [cardCode, onPaymentProcessing, emitResponse]);

    // Stop the block checkout with a readable message instead of creating an
    // order that can only fail at the gateway.
    useEffect(function () {
      if (typeof onCheckoutValidation !== 'function') return undefined;
      return onCheckoutValidation(function () {
        if (cardCode.trim() === '') {
          setError(__('Enter a gift card code.', 'tazella-gift-cards'));
          return { errorMessage: __('Enter a gift card code.', 'tazella-gift-cards') };
        }
        setError('');
        return true;
      });
    }, [cardCode, onCheckoutValidation]);

    return createElement(
      'div',
      { className: 'tazella-blocks-payment' },
      createElement('p', { className: 'woocommerce-description' }, description),
      createElement('input', {
        type: 'text',
        value: cardCode,
        onChange: function (event) {
          setCardCode(event.target.value);
          if (error) setError('');
        },
        placeholder: 'GFT-XXXXXXXXXX',
        autoComplete: 'off',
        autoCapitalize: 'characters',
        spellCheck: false,
        maxLength: 64,
        'aria-label': __('Gift card code', 'tazella-gift-cards'),
        'aria-invalid': error ? 'true' : 'false',
        style: { width: '100%', maxWidth: '320px', direction: 'ltr' },
      }),
      error
        ? createElement(
            'p',
            { className: 'tazella-blocks-error', role: 'alert', style: { color: '#b32d2e', marginTop: '6px' } },
            error
          )
        : null
    );
  }

  registry.registerPaymentMethod({
    name: 'tazella_gift_cards',
    label: createElement(Label),
    content: createElement(Content),
    edit: createElement(Content),
    canMakePayment: function () {
      return true;
    },
    ariaLabel: title,
    supports: { features: data.supports || ['products'] },
  });
})();
