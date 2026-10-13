import type { StageSequence, Step } from '../types/sequence';

/** 将新舞台事件投影为旧播放器可以逐条推进的 Step，保留旧项目兼容性。 */
export function stageSequenceToSteps(sequence: StageSequence): Step[] {
  return sequence.events.map((event) => {
    if (event.type === 'wait') {
      return {
        id: event.id,
        type: 'wait',
        text: '',
        speakText: '',
        duration: event.duration,
        sourceRef: event.sourceRef,
      };
    }

    return {
      id: event.id,
      type: 'dialogue',
      characterName: event.actor,
      poseName: event.pose,
      text: event.speakText,
      speakText: event.synthesisText || event.speakText,
      visualCue: event.visualCue,
      sourceRef: event.sourceRef,
    };
  });
}
