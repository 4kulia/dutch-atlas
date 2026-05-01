import { VIDEO_ID } from '../types';
import type { Lang } from '../types';

interface Props {
  startSeconds: number;
  title: string;
  lang: Lang;
}

// NOTE on audio language: this video has Russian/German/French/Polish/etc.
// audio dubs in addition to the original English. Unfortunately the YouTube
// IFrame API does not expose `setAudioTrack`, and there is no documented URL
// parameter to preset an audio track in an embed — YouTube selects the default
// based on the viewer's Accept-Language + their YouTube account preferences.
// We do what we can:
//   - hl=<lang> sets the player UI language and *hints* at preferred audio
//   - cc_lang_pref + cc_load_policy=1 force-enable subtitles in the UI language
//   - the AudioHint component (rendered separately) tells users how to switch.
export function VideoEmbed({ startSeconds, title, lang }: Props) {
  const params = new URLSearchParams({
    start: String(startSeconds),
    autoplay: '1',
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
    hl: lang,
    cc_lang_pref: lang,
    cc_load_policy: '1',
  });
  const src = `https://www.youtube-nocookie.com/embed/${VIDEO_ID}?${params.toString()}`;

  return (
    <div className="relative w-full" style={{ aspectRatio: '16 / 9' }}>
      <iframe
        key={src}
        src={src}
        title={title}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
        className="absolute inset-0 h-full w-full rounded-xl border border-ink-700/40 bg-ink-950"
      />
    </div>
  );
}
