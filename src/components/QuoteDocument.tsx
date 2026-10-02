import { formatEuros } from '../domain/money';
import { formatQuoteDate, QUOTE_FOOTER, quoteTotal, VAT_NOTE_TEXT } from '../domain/quotes';
import type { BusinessProfile, Quote } from '../domain/types';
import { isHttpUrl } from '../domain/validation';
import { ExampleTag } from './ExampleTag';
import { TileBand } from './TileBand';
import './QuoteDocument.css';

interface QuoteDocumentProps {
  quote: Quote;
  business: BusinessProfile;
  // Shown in the table while the quote has no valid item yet.
  emptyItemsText?: string;
}

// The quote as the client receives it: a sheet of paper, not an app panel.
export function QuoteDocument({ quote, business, emptyItemsText }: QuoteDocumentProps) {
  const name = business.name.trim();
  const place = [business.address.trim(), business.city.trim()].filter(Boolean).join(', ');
  const website = business.website.trim();
  const date = formatQuoteDate(quote.createdAt);
  const vat = VAT_NOTE_TEXT[quote.vatNote];

  return (
    <article className="orcamento-doc" aria-label={`Orçamento n.º ${quote.number}`}>
      <TileBand height={32} color={business.accentColor} />
      <div className="orcamento-doc__folha">
        <div className="orcamento-doc__topo">
          <div className="orcamento-doc__negocio">
            {name && <p className="orcamento-doc__nome">{name}</p>}
            {place && <p>{place}</p>}
            {business.phone.trim() && <p>{business.phone.trim()}</p>}
            {business.email.trim() && <p>{business.email.trim()}</p>}
            {website && (isHttpUrl(website)
              ? <p><a href={website} target="_blank" rel="noopener noreferrer">{website}</a></p>
              : <p>{website}</p>)}
          </div>
          <div className="orcamento-doc__ref">
            <p className="orcamento-doc__titulo">Orçamento</p>
            <p>N.º {quote.number}</p>
            {date && <p>{date}</p>}
            {quote.isExample && <p><ExampleTag /></p>}
          </div>
        </div>

        <div className="orcamento-doc__regra" style={{ background: business.accentColor }} />

        <div className="orcamento-doc__cliente">
          <p className="orcamento-doc__rotulo">Cliente</p>
          <p className="orcamento-doc__cliente-nome">{quote.clientName.trim() || 'Nome do cliente'}</p>
        </div>

        <table className="orcamento-doc__tabela">
          <thead>
            <tr>
              <th scope="col">Descrição</th>
              <th scope="col" className="orcamento-doc__valor">Preço</th>
            </tr>
          </thead>
          <tbody>
            {quote.items.length === 0 && emptyItemsText && (
              <tr>
                <td colSpan={2} className="orcamento-doc__sem-linhas">{emptyItemsText}</td>
              </tr>
            )}
            {quote.items.map((item) => (
              <tr key={item.id}>
                <td>{item.description.trim()}</td>
                <td className="orcamento-doc__valor">{formatEuros(item.priceCents)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              <td className="orcamento-doc__valor">{formatEuros(quoteTotal(quote))}</td>
            </tr>
          </tfoot>
        </table>
        {vat && <p className="orcamento-doc__iva">{vat}</p>}

        {quote.deadline.trim() && (
          <div className="orcamento-doc__bloco">
            <p className="orcamento-doc__rotulo">Prazo</p>
            <p>{quote.deadline.trim()}</p>
          </div>
        )}
        {quote.notes.trim() && (
          <div className="orcamento-doc__bloco">
            <p className="orcamento-doc__rotulo">Observações</p>
            <p className="orcamento-doc__notas">{quote.notes.trim()}</p>
          </div>
        )}

        <p className="orcamento-doc__rodape">{QUOTE_FOOTER}</p>
      </div>
    </article>
  );
}
