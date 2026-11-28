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
  var wordmark = data.icon || '';
  var mark = data.mark || '';

  function LockIcon() {
    return createElement(
      'svg',
      { viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true', focusable: 'false' },
      createElement('rect', {
        x: '4.5',
        y: '10',
        width: '15',
        height: '10.5',
        rx: '2.2',
        stroke: 'currentColor',
        strokeWidth: '1.7',
      }),
      createElement('path', {
        d: 'M8 10V7.6a4 4 0 0 1 8 0V10',
        stroke: 'currentColor',
        strokeWidth: '1.7',
        strokeLinecap: 'round',
      })
    );
  }

  function CardIcon() {
    return createElement(
      'svg',
      {
        className: 'tazella-gift-card-control-icon',
        viewBox: '0 0 24 24',
        fill: 'none',
        'aria-hidden': 'true',
        focusable: 'false',
      },
      createElement('rect', {
        x: '2.5',
        y: '5',
        width: '19',
        height: '14',
        rx: '2.5',
        stroke: 'currentColor',
        strokeWidth: '1.6',
      }),
      createElement('path', {
        d: 'M2.5 9.5h19',
        stroke: 'currentColor',
        strokeWidth: '1.6',
      }),
      createElement('path', {
        d: 'M6 14.5h4',
        stroke: 'currentColor',
        strokeWidth: '1.6',
        strokeLinecap: 'round',
      })
    );
  }

  function Label() {
    return createElement(
      'span',
      { className: 'tazella-blocks-label' },
      mark
        ? createElement('img', {
            src: mark,
            alt: '',
            className: 'tazella-blocks-mark',
            width: 22,
            height: 22,
            'aria-hidden': 'true',
          })
        : null,
      createElement('span', null, title)
    );
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
      { className: 'tazella-gift-card-panel tazella-blocks-panel' },
      createElement(
        'div',
        { className: 'tazella-gift-card-panel-head' },
        wordmark
          ? createElement('img', {
              className: 'tazella-gift-card-wordmark',
              src: wordmark,
              alt: 'Tazella',
              width: 122,
              height: 25,
            })
          : createElement('span', { className: 'tazella-gift-card-name' }, 'Tazella'),
        createElement(
          'span',
          { className: 'tazella-gift-card-secured' },
          createElement(LockIcon),
          __('Secured by Tazella', 'tazella-gift-cards')
        )
      ),
      description
        ? createElement('p', { className: 'tazella-gift-card-description' }, description)
        : null,
      createElement(
        'label',
        { className: 'tazella-gift-card-field' },
        createElement(
          'span',
          { className: 'tazella-gift-card-label' },
          __('Gift card code', 'tazella-gift-cards')
        ),
        createElement(
          'span',
          { className: 'tazella-gift-card-control' },
          createElement(CardIcon),
          createElement('input', {
            className: 'tazella-gift-card-input',
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
            dir: 'ltr',
            maxLength: 64,
            'aria-label': __('Gift card code', 'tazella-gift-cards'),
            'aria-invalid': error ? 'true' : 'false',
          })
        )
      ),
      createElement(
        'p',
        { className: 'tazella-gift-card-help' },
        __('The amount is confirmed by Tazella before payment.', 'tazella-gift-cards')
      ),
      error
        ? createElement(
            'p',
            { className: 'tazella-gift-card-error', role: 'alert' },
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
