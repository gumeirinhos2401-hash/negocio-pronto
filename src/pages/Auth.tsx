import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiFailure } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { Button, ButtonLink } from '../components/Button';
import { Field } from '../components/Field';
import { usePageTitle } from '../components/usePageTitle';
import { focusField } from './format';
import './Auth.css';

const MIN_PASSWORD = 10;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function AuthLayout({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <div className="conta">
      <header className="conta__topo">
        <Link to="/" className="app__marca">Negócio Pronto</Link>
      </header>
      <main className="conta__conteudo">
        <h1>{title}</h1>
        {intro && <p className="pagina__intro">{intro}</p>}
        {children}
      </main>
    </div>
  );
}

function FormError({ message }: { message: string | null }) {
  return message ? <p className="nota conta__erro" role="alert">{message}</p> : null;
}

const messageOf = (error: unknown) => (error instanceof ApiFailure ? error.message : 'Ocorreu um erro. Tente de novo.');

// Sign-in and sign-up share the form: only the wording and the request differ.
function Credentials({ mode }: { mode: 'entrar' | 'criar' }) {
  const creating = mode === 'criar';
  usePageTitle(creating ? 'Criar conta' : 'Entrar');
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [failure, setFailure] = useState<string | null>(auth.startError);
  const [busy, setBusy] = useState(false);

  if (auth.user) return <Navigate to="/painel" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: typeof errors = {};
    if (!EMAIL.test(email.trim())) next.email = 'Indique um email válido.';
    if (creating && password.length < MIN_PASSWORD) next.password = `A palavra-passe precisa de pelo menos ${MIN_PASSWORD} caracteres.`;
    if (!creating && password === '') next.password = 'Indique a palavra-passe.';
    setErrors(next);
    setFailure(null);
    if (next.email || next.password) {
      focusField(next.email ? 'conta-email' : 'conta-palavra-passe');
      return;
    }
    setBusy(true);
    try {
      await (creating ? auth.signUp(email.trim(), password) : auth.signIn(email.trim(), password));
    } catch (error) {
      setBusy(false);
      if (error instanceof ApiFailure && error.code === 'email-em-uso') {
        setErrors({ email: error.message });
        focusField('conta-email');
      } else setFailure(messageOf(error));
    }
  };

  return (
    <AuthLayout
      title={creating ? 'Criar conta' : 'Entrar'}
      intro={creating ? 'Com uma conta, os seus dados ficam guardados e pode usá-los em qualquer dispositivo.' : undefined}
    >
      <form className="pilha" onSubmit={submit} noValidate>
        <FormError message={failure} />
        <Field label="Email" id="conta-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={setEmail} error={errors.email} required maxLength={254} />
        <Field
          label="Palavra-passe" id="conta-palavra-passe" type="password" value={password} onChange={setPassword} error={errors.password} required maxLength={200}
          autoComplete={creating ? 'new-password' : 'current-password'}
          hint={creating ? `Pelo menos ${MIN_PASSWORD} caracteres.` : undefined}
        />
        <div className="acoes">
          <Button variant="primary" type="submit" disabled={busy}>{creating ? 'Criar conta' : 'Entrar'}</Button>
        </div>
      </form>
      <p className="conta__alternativa">
        {creating
          ? <>Já tem conta? <Link to="/entrar">Entrar</Link></>
          : <><Link to="/recuperar">Esqueci-me da palavra-passe</Link><br />Ainda não tem conta? <Link to="/criar-conta">Criar conta</Link></>}
      </p>
    </AuthLayout>
  );
}

export const SignIn = () => <Credentials mode="entrar" />;
export const SignUp = () => <Credentials mode="criar" />;

export function ForgotPassword() {
  usePageTitle('Recuperar palavra-passe');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();
  const [failure, setFailure] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFailure(null);
    if (!EMAIL.test(email.trim())) {
      setError('Indique um email válido.');
      focusField('recuperar-email');
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      await api('POST', '/api/auth/forgot', { email: email.trim() });
      setSent(true);
    } catch (problem) {
      setFailure(messageOf(problem));
    }
    setBusy(false);
  };

  return (
    <AuthLayout title="Recuperar palavra-passe" intro="Indique o email da conta. Enviamos uma ligação para escolher uma nova palavra-passe.">
      {sent ? (
        <p className="nota" role="status">
          Se existir uma conta com esse email, a mensagem segue dentro de momentos. A ligação é válida durante 1 hora.
        </p>
      ) : (
        <form className="pilha" onSubmit={submit} noValidate>
          <FormError message={failure} />
          <Field label="Email" id="recuperar-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={setEmail} error={error} required maxLength={254} />
          <div className="acoes">
            <Button variant="primary" type="submit" disabled={busy}>Enviar ligação</Button>
          </div>
        </form>
      )}
      <p className="conta__alternativa"><Link to="/entrar">Voltar à entrada</Link></p>
    </AuthLayout>
  );
}

export function ResetPassword() {
  usePageTitle('Nova palavra-passe');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [failure, setFailure] = useState<string | null>(token ? null : 'Esta ligação já não é válida. Peça uma nova.');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < MIN_PASSWORD) {
      setError(`A palavra-passe precisa de pelo menos ${MIN_PASSWORD} caracteres.`);
      focusField('repor-palavra-passe');
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      await api('POST', '/api/auth/reset', { token, password });
      navigate('/entrar', { replace: true, state: { reset: true } });
    } catch (problem) {
      setFailure(messageOf(problem));
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Nova palavra-passe" intro="Depois de guardar, entra com a nova palavra-passe. As sessões abertas noutros dispositivos terminam.">
      <form className="pilha" onSubmit={submit} noValidate>
        <FormError message={failure} />
        <Field label="Nova palavra-passe" id="repor-palavra-passe" type="password" autoComplete="new-password" value={password} onChange={setPassword} error={error} required maxLength={200} hint={`Pelo menos ${MIN_PASSWORD} caracteres.`} />
        <div className="acoes">
          <Button variant="primary" type="submit" disabled={busy || !token}>Guardar palavra-passe</Button>
        </div>
      </form>
      <p className="conta__alternativa"><Link to="/recuperar">Pedir uma nova ligação</Link></p>
    </AuthLayout>
  );
}

export function VerifyEmail() {
  usePageTitle('Confirmar email');
  const [params] = useSearchParams();
  const auth = useAuth();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<'a-confirmar' | 'confirmado' | 'falhou'>(token ? 'a-confirmar' : 'falhou');
  const [failure, setFailure] = useState('Esta ligação já não é válida. Peça uma nova nas definições.');
  const started = useRef(false);
  const { refresh } = auth;

  useEffect(() => {
    // The link works once, so the request must not be repeated when the effect runs again.
    if (!token || started.current) return;
    started.current = true;
    api('POST', '/api/auth/verify', { token })
      .then(async () => {
        await refresh();
        setState('confirmado');
      })
      .catch((problem) => {
        setFailure(messageOf(problem));
        setState('falhou');
      });
  }, [token, refresh]);

  return (
    <AuthLayout title="Confirmar email">
      {state === 'a-confirmar' && <p role="status">A confirmar o seu email…</p>}
      {state === 'confirmado' && <p className="nota" role="status">Email confirmado.</p>}
      {state === 'falhou' && <p className="nota conta__erro" role="alert">{failure}</p>}
      <div className="acoes">
        <ButtonLink to={auth.user ? '/painel' : '/entrar'} variant="primary">{auth.user ? 'Ir para o painel' : 'Entrar'}</ButtonLink>
      </div>
    </AuthLayout>
  );
}
