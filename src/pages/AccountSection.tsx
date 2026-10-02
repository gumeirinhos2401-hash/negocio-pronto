import { useState, type FormEvent } from 'react';
import { api, ApiFailure } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { Field } from '../components/Field';
import { useToast } from '../components/Toast';
import { focusField } from './format';

export function AccountSection() {
  const auth = useAuth();
  const toast = useToast();
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const user = auth.user;
  if (!user) return null;

  const resend = async () => {
    try {
      await api('POST', '/api/auth/verify/resend');
      toast.show('Email de confirmação enviado');
    } catch (error) {
      if (error instanceof ApiFailure && error.code === 'ja-confirmado') await auth.refresh();
      else toast.show(error instanceof ApiFailure ? error.message : 'Não foi possível enviar o email.', 'error');
    }
  };

  const closeDialog = () => {
    setDeleting(false);
    setPassword('');
    setPasswordError(undefined);
  };

  const deleteAccount = async (event: FormEvent) => {
    event.preventDefault();
    if (password === '') {
      setPasswordError('Indique a palavra-passe.');
      focusField('conta-apagar-palavra-passe');
      return;
    }
    setBusy(true);
    try {
      await api('DELETE', '/api/account', { password });
      toast.show('Conta apagada');
      auth.sessionEnded();
    } catch (error) {
      setBusy(false);
      setPasswordError(error instanceof ApiFailure ? error.message : 'Não foi possível apagar a conta.');
      focusField('conta-apagar-palavra-passe');
    }
  };

  return (
    <section className="seccao definicoes__seccao" aria-labelledby="sec-conta">
      <div>
        <h2 className="seccao__titulo" id="sec-conta">Conta</h2>
        <p className="seccao__texto texto-utilizador">{user.email}</p>
      </div>
      <ul className="lista-linhas definicoes__dados">
        {!user.emailVerified && (
          <li>
            <div>
              <h3>Email por confirmar</h3>
              <p className="secundario">Enviámos uma ligação para o seu email quando criou a conta. É ela que permite recuperar a palavra-passe.</p>
            </div>
            <Button onClick={resend}>Reenviar email de confirmação</Button>
          </li>
        )}
        <li>
          <div>
            <h3>Sessão</h3>
            <p className="secundario">Termina a sessão neste dispositivo. Os dados ficam guardados na conta.</p>
          </div>
          <Button onClick={() => void auth.signOut()}>Terminar sessão</Button>
        </li>
        <li>
          <div>
            <h3>Apagar conta</h3>
            <p className="secundario">Apaga a conta e tudo o que ela guarda.</p>
          </div>
          <Button variant="danger" onClick={() => setDeleting(true)}>Apagar conta</Button>
        </li>
      </ul>

      <Dialog open={deleting} title="Apagar a conta?" onClose={closeDialog}>
        <form className="pilha" onSubmit={deleteAccount} noValidate>
          <p>A conta, o perfil, as publicações, o calendário, as respostas e os orçamentos são apagados. Esta ação não pode ser desfeita.</p>
          <Field label="Palavra-passe" id="conta-apagar-palavra-passe" type="password" autoComplete="current-password" value={password} onChange={setPassword} error={passwordError} required maxLength={200} />
          <div className="dialogo__acoes">
            <Button onClick={closeDialog}>Cancelar</Button>
            <Button variant="danger" type="submit" disabled={busy}>Apagar conta</Button>
          </div>
        </form>
      </Dialog>
    </section>
  );
}
