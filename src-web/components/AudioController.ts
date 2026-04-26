import { events } from '@web/services/eventBus.ts';
import { AudioManager } from '@web/services/audioService.ts';
import * as speech from '@web/services/speechService.ts';
import * as notification from '@web/services/notificationService.ts';
import { getConfig } from '@web/services/configStore.ts';
import { formatTimestamp, formatToChineseTime, int_to_string, findMaxIntensityCity, intensity_list } from '@web/utils/utils.ts';
import { now } from '@web/services/ntpService.ts';
import type { EewData, ReportListItem, IntensityData, LpgmData, TremEventPayload } from '@web/types/index.ts';
import { getStation } from '@web/services/stationResource.ts';
import { search_loc_name } from '@web/utils/utils.ts';

const ttsCache: Record<string, { last: { loc: string; i: number }; now: { loc: string; i: number } }> = {};
let ttsEewAlertLock = false;

export function initAudioController(): void {
  const audio = AudioManager.getInstance();

  events.on<EewData>('EewRelease', (ans) => {
    audio.playEewRelease(ans.data.status);
    ttsCache[ans.data.id] = {
      last: { loc: '', i: -1 },
      now: { loc: ans.data.eq.loc, i: ans.data.eq.max },
    };
    const cfg = getConfig();
    notification.sendNotification(
      `${ans.data.status === 1 ? '🚨 緊急地震速報' : '⚠️ 地震速報'} ${ans.data.serial}報`,
      { body: `${formatTimestamp(ans.data.eq.time)} 最大預估 ${intensity_list[ans.data.eq.max]}\n${ans.data.eq.loc} M${ans.data.eq.mag} ${ans.data.eq.depth}km` },
    );
  });

  events.on<EewData>('EewAlert', (ans) => audio.playEewAlert());
  events.on<EewData>('EewUpdate', (ans) => {
    audio.playEewUpdate();
    if (ttsCache[ans.data.id]) {
      ttsCache[ans.data.id].now.loc = ans.data.eq.loc;
      ttsCache[ans.data.id].now.i = ans.data.eq.max;
    }
    notification.sendNotification(
      `${ans.data.status === 1 ? '🚨 緊急地震速報' : '⚠️ 地震速報'} ${ans.data.serial}報`,
      { body: `${formatTimestamp(ans.data.eq.time)} 最大預估 ${intensity_list[ans.data.eq.max]}\n${ans.data.eq.loc} M${ans.data.eq.mag} ${ans.data.eq.depth}km` },
    );
  });
  events.on<EewData>('EewCancel', () => audio.playEewCancel());
  events.on<EewData>('EewEnd', (ans) => { delete ttsCache[ans.data.id]; });

  events.on('RtsPga2', () => audio.playRtsPga2());
  events.on('RtsPga1', () => audio.playRtsPga1());
  events.on('RtsShindo2', () => {
    audio.playRtsShindo2();
    notification.sendNotification(`🟥 強震檢測 [${formatTimestamp(now())}]`, { body: '請注意今後的資訊。' });
  });
  events.on('RtsShindo1', () => {
    audio.playRtsShindo1();
    notification.sendNotification(`🟧 震動檢測 [${formatTimestamp(now())}]`, { body: '請注意今後的資訊。' });
  });
  events.on('RtsShindo0', () => {
    audio.playRtsShindo0();
    notification.sendNotification(`🟩 弱反應 [${formatTimestamp(now())}]`, { body: '請注意今後的資訊。' });
  });
  events.on('TsunamiRelease', () => audio.playTsunami());

  events.on<ReportListItem>('ReportRelease', (ans) => {
    audio.playReport();
    const cfg = getConfig();
    if (!cfg.notification.speech) return;

    const item = ans.data;
    const loc = extractReportLoc(item.loc ?? '');
    const time = formatToChineseTime(String(item.time));
    const intensityStr = int_to_string(item.int);

    const ttsText = `地震報告，${time}，${loc}發生地震，震源深度${item.depth}公里，地震規模${item.mag?.toFixed(1)}，最大震度${intensityStr}`;
    speech.speak(ttsText
      .replaceAll('三地門', '三弟門')
      .replaceAll('.', '點')
      .replaceAll('為', '圍'));

    const idPart = item.id.split('-')[0];
    notification.sendNotification(
      `🔔 地震報告 [${idPart.includes('000') ? '小區域有感地震' : idPart}]`,
      { body: `${time} ${loc}發生地震 M${item.mag?.toFixed(1)} 最大${intensityStr}` },
    );
  });

  events.on<IntensityData>('IntensityRelease', (ans) => {
    audio.playIntensity();
    const cfg = getConfig();
    const result = findMaxIntensityCity(ans.data.area);
    if (!result) return;
    const text = int_to_string(result.intensity).replace('級', '');
    if (cfg.notification.speech) speech.speak(`震度速報，震度${text}，${result.cities.join('、')}`, true);
    notification.sendNotification(`📨 震度速報 [${formatTimestamp(ans.data.id)}]`, {
      body: `震度${text} ${result.cities.join('、')}`,
    });
  });

  events.on<LpgmData>('LpgmRelease', (ans) => {
    audio.playIntensity();
    const cfg = getConfig();
    const station = getStation();
    if (!station) return;

    let maxI = 0, maxCity = '';
    for (const s of ans.data.list) {
      if (!s.lpgm) continue;
      const sInfo = station[s.id];
      if (!sInfo) continue;
      const sLoc = sInfo.info.at(-1);
      if (!sLoc) continue;
      const loc = search_loc_name(sLoc.code);
      if (loc && s.lpgm > maxI) { maxI = s.lpgm; maxCity = loc.city; }
    }

    const time = formatToChineseTime(String(ans.data.id));
    notification.sendNotification('🔔 長週期地震動', {
      body: `${time.replace('點', ':').replace('分', '')}，${maxCity}觀測到最大長週期地震動階級${maxI}。`,
    });
    if (cfg.notification.speech) {
      speech.speak(`長週期地震動觀測資訊，${time}，${maxCity}觀測到最大長週期地震動階級${maxI}`.replaceAll('為', '圍'));
    }
  });

  events.on<EewData>('EewNewAreaAlert', (ans) => {
    const cfg = getConfig();
    if (!cfg.notification.speech) return;
    if (speech.isSpeaking()) speech.cancel();
    ttsEewAlertLock = true;
    const cityList = (ans.data as EewData & { city_alert_list: string[] }).city_alert_list ?? [];
    speech.speak(`緊急地震速報，${cityList.join('、')}，慎防強烈搖晃`);
    setTimeout(() => { ttsEewAlertLock = false; }, 5000);
  });

  // TTS interval for EEW
  setInterval(() => {
    if (ttsEewAlertLock) return;
    const cfg = getConfig();
    if (!cfg.notification.speech) return;
    for (const id of Object.keys(ttsCache)) {
      const c = ttsCache[id];
      if (c.now.i > c.last.i) {
        c.last.loc = c.now.loc;
        speech.speak(`${c.last.loc}發生地震`, true);
        c.last.i = c.now.i;
        speech.speak(`預估最大震度${!c.last.i ? '不明' : intensity_list[c.last.i].replace('⁻', '弱').replace('⁺', '強')}`, true);
      }
    }
  }, 3000);
}

function extractReportLoc(loc: string): string {
  const match = loc.match(/位於(.+?)(?=\))/);
  let extracted = match ? match[1] : loc;
  const spaceIndex = extracted.indexOf(' ');
  if (spaceIndex !== -1) extracted = extracted.substring(0, spaceIndex);
  return extracted;
}
