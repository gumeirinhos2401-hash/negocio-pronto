import { useCallback } from 'react';
import { Copy } from 'lucide-react';
import { Button, type ButtonVariant } from './Button';
import { useToast } from './Toast';

// Older browsers and pages without clipboard permission: copy through a hidden textarea.
function copyWithTextArea(text: string): boolean {
  if (typeof document.execCommand !== 'function') return false;
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  area.remove();
  return copied;
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Falls through to the textarea method.
  }
  return copyWithTextArea(text);
}

// Copies a text and tells the user whether it worked.
export function useCopy(): (text: string) => Promise<void> {
  const toast = useToast();
  return useCallback(async (text: string) => {
    if (await copyText(text)) toast.show('Texto copiado');
    else toast.show('Não foi possível copiar. Selecione o texto e copie manualmente.', 'error');
  }, [toast]);
}

interface CopyButtonProps {
  text: string;
  label?: string;
  variant?: ButtonVariant;
}

export function CopyButton({ text, label = 'Copiar', variant = 'quiet' }: CopyButtonProps) {
  const copy = useCopy();
  return (
    <Button variant={variant} onClick={() => void copy(text)}>
      <Copy aria-hidden="true" />
      {label}
    </Button>
  );
}
