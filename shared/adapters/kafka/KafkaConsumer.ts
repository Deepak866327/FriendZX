import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { Logger } from '../../utils/logger';

const logger = new Logger('KafkaConsumer');

export interface MessageHandler {
  (message: any): Promise<void>;
}

export class KafkaConsumer {
  private kafka: Kafka;
  private consumer: Consumer;
  private isConnected: boolean = false;
  private handlers: Map<string, MessageHandler[]> = new Map();

  constructor(
    serviceName: string,
    groupId: string,
    brokers: string[] = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',')
  ) {
    this.kafka = new Kafka({
      clientId: `${serviceName}-consumer`,
      brokers,
      retry: {
        initialRetryTime: 300,
        retries: 8,
        maxRetryTime: 30000,
        multiplier: 2,
      },
    });

    this.consumer = this.kafka.consumer({
      groupId,
      sessionTimeout: 60000,
      heartbeatInterval: 3000,
      allowAutoTopicCreation: true,
    });

    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.consumer.on('consumer.connect', () => {
      logger.info('Kafka consumer connected');
      this.isConnected = true;
    });

    this.consumer.on('consumer.disconnect', () => {
      logger.warn('Kafka consumer disconnected');
      this.isConnected = false;
    });

    this.consumer.on('consumer.crash', (event: any) => {
      const { error, groupId } = event.payload || event;
      logger.error(`Kafka consumer crashed in group ${groupId}: ${error?.message}`);
    });

    this.consumer.on('consumer.network.request_timeout', ({ payload }) => {
      logger.error('Kafka consumer request timeout', { payload });
    });
  }

  async connect(): Promise<void> {
    try {
      if (!this.isConnected) {
        await this.consumer.connect();
        logger.info('Kafka consumer connected successfully');
      }
    } catch (error) {
      logger.error(`Failed to connect Kafka consumer: ${(error as Error).message}`);
      throw error;
    }
  }

  async subscribe(topic: string, handler: MessageHandler): Promise<void> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      if (!this.handlers.has(topic)) {
        this.handlers.set(topic, []);
      }
      this.handlers.get(topic)!.push(handler);

      await this.consumer.subscribe({ topic, fromBeginning: false });
      logger.info(`Subscribed to topic: ${topic}`);
    } catch (error) {
      logger.error(`Failed to subscribe to topic ${topic}: ${(error as Error).message}`);
      throw error;
    }
  }

  async run(): Promise<void> {
    try {
      await this.consumer.run({
        eachMessage: this.handleMessage.bind(this),
      });
      logger.info('Kafka consumer started consuming messages');
    } catch (error) {
      logger.error(`Failed to run consumer: ${(error as Error).message}`);
      throw error;
    }
  }

  private async handleMessage({ topic, message, partition }: EachMessagePayload): Promise<void> {
    try {
      const handlers = this.handlers.get(topic) || [];

      if (handlers.length === 0) {
        logger.warn(`No handlers registered for topic: ${topic}`);
        return;
      }

      const data = message.value ? JSON.parse(message.value.toString()) : null;

      logger.debug(`Received message from topic ${topic} (partition: ${partition})`, {
        messageId: data?.messageId,
      });

      for (const handler of handlers) {
        try {
          await handler(data);
        } catch (error) {
          logger.error(`Error in message handler for topic ${topic}: ${(error as Error).message}`);
        }
      }
    } catch (error) {
      logger.error(`Failed to process message from topic ${topic}: ${(error as Error).message}`);
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.isConnected) {
        await this.consumer.disconnect();
        logger.info('Kafka consumer disconnected');
      }
    } catch (error) {
      logger.error(`Failed to disconnect Kafka consumer: ${(error as Error).message}`);
    }
  }

  isConnectedState(): boolean {
    return this.isConnected;
  }
}