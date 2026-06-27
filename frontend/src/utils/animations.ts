import { Variants, Transition } from 'framer-motion';

export const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1];

export const overlayVariants: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.18 } },
  exit:    { opacity: 0, transition: { duration: 0.18 } },
};

export const pageVariants: Variants = {
  hidden:  { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0,  transition: { duration: 0.20, ease: EASE } },
  exit:    { opacity: 0, y: -6, transition: { duration: 0.12, ease: EASE } },
};

export const modalVariants: Variants = {
  hidden:  { opacity: 0, scale: 0.96, y: 14 },
  visible: { opacity: 1, scale: 1,    y: 0,  transition: { type: 'spring', damping: 28, stiffness: 380 } },
  exit:    { opacity: 0, scale: 0.96, y: 14, transition: { duration: 0.14, ease: EASE } },
};

export const sheetVariants: Variants = {
  hidden:  { y: '100%' },
  visible: { y: 0,      transition: { type: 'spring', damping: 30, stiffness: 340 } },
  exit:    { y: '100%', transition: { duration: 0.22, ease: EASE } },
};

export const feedItemVariants: Variants = {
  hidden:  { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0,  transition: { duration: 0.22, ease: EASE } },
};

export const staggerListVariants: Variants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.06 } },
};

export const staggerItemVariants: Variants = {
  hidden:  { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE } },
};

export const springTransition: Transition = {
  type: 'spring', damping: 28, stiffness: 380,
};
