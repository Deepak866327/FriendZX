import { Kafka, Producer } from 'kafkajs';
import { Logger } from '../../utils/logger';

const logger = new Logger('KafkaProducer');

export class KafkaProducer {
  private kafka: Kafka;
  private producer: Producer;
  private isConnected: boolean = false;

  constructor(
    serviceName: string,
    brokers: string[] = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',')
  ) {
    this.kafka = new Kafka({
      clientId: `${serviceName}-producer`,
      brokers,
      retry: {
        initialRetryTime: 300,
        retries: 8,
        maxRetryTime: 30000,
        multiplier: 2,
      },
    });

    this.producer = this.kafka.producer({
      allowAutoTopicCreation: true,
      transactionTimeout: 60000,
    });

    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.producer.on('producer.connect', () => {
      logger.info('Kafka producer connected');
      this.isConnected = true;
    });

    this.producer.on('producer.disconnect', () => {
      logger.warn('Kafka producer disconnected');
      this.isConnected = false;
    });

    this.producer.on('producer.network.request_timeout', ({ payload }) => {
      logger.error('Kafka producer request timeout', { payload });
    });
  }

  async connect(): Promise<void> {
    try {
      if (!this.isConnected) {
        await this.producer.connect();
        logger.info('Kafka producer connected successfully');
      }
    } catch (error) {
      logger.error(`Failed to connect Kafka producer: ${(error as Error).message}`);
      throw error;
    }
  }

  async publish(topic: string, message: any, key?: string): Promise<void> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      await this.producer.send({
        topic,
        messages: [
          {
            key: key || null,
            value: JSON.stringify({
              ...message,
              timestamp: new Date().toISOString(),
              messageId: `${Date.now()}-${Math.random()}`,
            }),
          },
        ],
      });

      logger.debug(`Message published to topic: ${topic}`, { key, messageId: message.id });
    } catch (error) {
      logger.error(`Failed to publish to topic ${topic}: ${(error as Error).message}`);
      throw error;
    }
  }

  async publishBatch(topic: string, messages: any[]): Promise<void> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      await this.producer.send({
        topic,
        messages: messages.map((msg) => ({
          value: JSON.stringify({
            ...msg,
            timestamp: new Date().toISOString(),
          }),
        })),
      });

      logger.debug(`${messages.length} messages published to topic: ${topic}`);
    } catch (error) {
      logger.error(`Failed to publish batch to topic ${topic}: ${(error as Error).message}`);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.isConnected) {
        await this.producer.disconnect();
        logger.info('Kafka producer disconnected');
      }
    } catch (error) {
      logger.error(`Failed to disconnect Kafka producer: ${(error as Error).message}`);
    }
  }

  isConnectedState(): boolean {
    return this.isConnected;
  }
}