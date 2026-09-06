import '@shopify/ui-extensions/preact';
import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useShippingAddress, useAppMetafields } from '@shopify/ui-extensions/checkout/preact';

export default function () {
  render(<Extension />, document.body);
}

const METAFIELD_NAMESPACE = 'custom';
const METAFIELD_KEY = 'business_registration_number';
const REGISTRATION_NUMBER_PATTERN = /^UA\d{8,10}$/;
const MAX_LENGTH = 12;

// Blocks characters a code can never contain. The exact shape is checked on submit.
function sanitizeInput(raw) {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, MAX_LENGTH);
}

function getValidationError(value, translate) {
  if (!value) return undefined;
  if (!REGISTRATION_NUMBER_PATTERN.test(value)) return translate('errorFormat');
  return undefined;
}

// Requires an order metafield definition with the cart_to_order_copyable capability.
async function saveRegistrationNumber(value) {
  if (!shopify.instructions.value.metafields.canSetCartMetafields) return;

  await shopify.applyMetafieldChange(
    value
      ? {
          type: 'updateCartMetafield',
          metafield: {
            namespace: METAFIELD_NAMESPACE,
            key: METAFIELD_KEY,
            type: 'single_line_text_field',
            value,
          },
        }
      : {
          type: 'removeCartMetafield',
          namespace: METAFIELD_NAMESPACE,
          key: METAFIELD_KEY,
        }
  );
}

function Extension() {
  const { i18n: { translate } } = shopify;

  const shippingAddress = useShippingAddress();
  const companyFilled = Boolean(shippingAddress?.company?.trim());

  const savedMetafields = useAppMetafields({
    type: 'cart',
    namespace: METAFIELD_NAMESPACE,
    key: METAFIELD_KEY,
  });
  const savedValue = savedMetafields[0]?.metafield?.value ?? '';

  const [value, setValue] = useState(savedValue);
  const [error, setError] = useState(undefined);
  const edited = useRef(false);

  // Restores the saved value only while the field is untouched.
  useEffect(() => {
    if (!edited.current && savedValue) {
      setValue(savedValue);
    }
  }, [savedValue]);

  // Current state for the interceptor, which is registered once.
  const latestValue = useRef(value);
  const latestCompanyFilled = useRef(companyFilled);
  latestValue.current = value;
  latestCompanyFilled.current = companyFilled;

  // Blocks checkout progress when the field is filled with an invalid code.
  useEffect(() => {
    const unsubscribePromise = shopify.buyerJourney.intercept(async ({ canBlockProgress }) => {
      if (!latestCompanyFilled.current) {
        return { behavior: 'allow' };
      }

      const currentValue = latestValue.current;
      const validationError = getValidationError(currentValue, shopify.i18n.translate);

      if (validationError) {
        if (!canBlockProgress) {
          return { behavior: 'allow' };
        }

        setError(validationError);
        return {
          behavior: 'block',
          reason: 'Invalid business registration number',
          errors: [{ message: validationError }],
        };
      }

      // Commits the value before checkout proceeds.
      await saveRegistrationNumber(currentValue);
      return { behavior: 'allow' };
    });

    return () => {
      unsubscribePromise.then((unsubscribe) => unsubscribe());
    };
  }, []);

  if (!companyFilled) {
    return null;
  }

  function handleInput(event) {
    edited.current = true;

    const raw = event.currentTarget.value ?? '';
    const next = sanitizeInput(raw);
    setValue(next);

    // Reflects the sanitized value back into the field.
    if (raw !== next) {
      event.currentTarget.value = next;
    }

    if (error) setError(undefined);
  }

  // Persists a valid value without surfacing errors.
  function handleBlur() {
    if (!getValidationError(value, translate)) {
      saveRegistrationNumber(value);
    }
  }

  return (
    <s-stack gap="tight">
      <s-text-field
        label={translate('fieldLabel')}
        value={value}
        error={error}
        maxLength={MAX_LENGTH}
        onInput={handleInput}
        onBlur={handleBlur}
      ></s-text-field>
      <s-text type="small" color="subdued">{translate('fieldHelpText')}</s-text>
    </s-stack>
  );
}
