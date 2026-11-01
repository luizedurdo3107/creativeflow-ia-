import { CHANNELS, STUDIO_FORMATS } from '@cf/shared';
import { useQuery } from '@tanstack/react-query';
import { api, type InstitutionalCampaign, type InstitutionalFormat } from '../api/client';

function Piece({ campaign, format, disabled, onEdit }: {
  campaign: InstitutionalCampaign;
  format: InstitutionalFormat;
  disabled: boolean;
  onEdit: (format: InstitutionalFormat) => void;
}) {
  const preview = useQuery({
    queryKey: ['institutional-preview', campaign.id, format, campaign.updatedAt],
    queryFn: () => api.previewInstitutional(campaign.id, format),
  });
  const spec = STUDIO_FORMATS[format];
  const destinations = CHANNELS.filter(c => campaign.input.channels?.includes(c.id) && (c.formats as readonly string[]).includes(format));
  return <article className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
    <div className="flex h-52 items-center justify-center bg-slate-100 p-3">
      {preview.data ? <img
        src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(preview.data.svg)}`}
        alt={`Peça ${spec.label} da campanha ${campaign.name}`}
        className="h-full w-full object-contain"
      /> : preview.isError ? <div className="text-center text-xs text-red-700"><p>Não foi possível carregar esta peça.</p><button type="button" className="mt-2 underline" onClick={() => void preview.refetch()}>Tentar novamente</button></div> : <p className="text-xs text-slate-500" role="status">Preparando peça...</p>}
    </div>
    <div className="flex flex-1 flex-col p-3">
      <h3 className="text-sm font-bold">{spec.label}</h3>
      <p className="mt-1 text-xs text-slate-500">{spec.width} × {spec.height} px</p>
      <p className="my-2 flex-1 text-xs leading-5 text-slate-600">{destinations.map(c => c.label).join(' · ') || 'Escolha um canal compatível abaixo.'}</p>
      <button type="button" disabled={disabled} onClick={() => onEdit(format)} className="w-full rounded-lg border border-teal-200 px-3 py-2 text-xs font-semibold text-teal-900 hover:bg-teal-50 disabled:opacity-40">Editar peça {spec.label}</button>
    </div>
  </article>;
}

export function CampaignPieces({ campaign, disabled, onEdit }: {
  campaign: InstitutionalCampaign;
  disabled: boolean;
  onEdit: (format: InstitutionalFormat) => void;
}) {
  const channels = CHANNELS.filter(c => campaign.input.channels?.includes(c.id));
  return <section aria-label="Peças da campanha" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-lg font-bold">Um briefing, várias peças</h2><p className="mt-1 text-sm text-slate-600">A mesma mensagem e identidade visual, com composições adaptadas aos formatos escolhidos.</p></div>
      <span className="rounded-full bg-teal-50 px-3 py-2 text-xs font-bold text-teal-900">{campaign.input.formats.length} {campaign.input.formats.length === 1 ? 'peça' : 'peças'} · {channels.length} {channels.length === 1 ? 'canal' : 'canais'}</span>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
      {campaign.input.formats.map(format => <Piece key={format} campaign={campaign} format={format} disabled={disabled} onEdit={onEdit} />)}
    </div>
    <div className="mt-4 flex flex-wrap gap-2" aria-label="Destinos das peças">{channels.map(c => <span key={c.id} className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700">{c.label} · {campaign.input.formats.filter(f => (c.formats as readonly string[]).includes(f)).map(f => STUDIO_FORMATS[f].label).join(', ')}</span>)}</div>
    <p className="mt-3 text-xs text-slate-500">As peças são criadas juntas a partir do briefing. Cada formato pode ser editado separadamente; os textos de publicação ficam na seção de canais. A exportação fica disponível após a aprovação.</p>
  </section>;
}
