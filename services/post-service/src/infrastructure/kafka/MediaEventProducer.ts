import { KafkaProducer } from '../../../../../shared/adapters/kafka/KafkaProducer';

export type MediaEvent =
  | 'MEDIA_UPLOADED'
  | 'MEDIA_PROCESSING_STARTED'
  | 'MEDIA_PROCESSING_COMPLETED'
  | 'MEDIA_PROCESSING_FAILED'
  | 'POST_CREATED';

const TOPIC = 'post-service-events';

export class MediaEventProducer {
  constructor(private readonly producer: KafkaProducer) {}

  async emit(event: MediaEvent, payload: object): Promise<void> {
    await this.producer.publish(TOPIC, {
      event,
      payload,
      timestamp: new Date().toISOString(),
    });
  }
}
