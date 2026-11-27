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
  var getSetting = settingsStore.getSetting;
  var data = getSetting('tazella_gift_cards_data', {}) || {};

  function Label() {
    return createElement('span', null, data.title || 'Tazella gift card');
  }

  function Content(props) {
    var eventRegistration = props.eventRegistration || {};
    var emitResponse = props.emitResponse || {};
    var onPaymentProcessing = eventRegistration.onPaymentProcessing;
    var cardCodeState = useState('');
    var cardCode = cardCodeState[0];
    var setCardCode = cardCodeState[1];

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

    return createElement(
      'div',
      { className: 'tazella-blocks-payment' },
      createElement(
        'p',
        { className: 'woocommerce-description' },
        data.description || __('Pay with a Tazella gift card.', 'tazella-gift-cards')
      ),
      createElement('input', {
        type: 'text',
        value: cardCode,
        onChange: function (event) {
          setCardCode(event.target.value);
        },
        placeholder: 'GFT-XXXXXXXXXX',
        autoComplete: 'off',
        'aria-label': __('Gift card code', 'tazella-gift-cards'),
        style: { width: '100%', maxWidth: '320px' },
      })
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
    ariaLabel: data.title || 'Tazella gift card',
    supports: { features: ['products'] },
  });
})();
