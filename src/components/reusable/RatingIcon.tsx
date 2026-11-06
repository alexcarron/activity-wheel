import type { RatingFeedbackAction } from '../../domain-logic/types';
import { HeartIcon } from '../svg-icons/HeartIcon';
import { BrokenHeartIcon } from '../svg-icons/BrokenHeartIcon';
import { ThumbsUpIcon } from '../svg-icons/ThumbsUpIcon';
import { NeutralFaceIcon } from '../svg-icons/NeutralFaceIcon';
import { ThumbsDownIcon } from '../svg-icons/ThumbsDownIcon';

export function RatingIcon({ action }: { action: RatingFeedbackAction }) {
	switch (action) {
		case 'love':
			return <HeartIcon />;
		case 'like':
			return <ThumbsUpIcon />;
		case 'neutral':
			return <NeutralFaceIcon />;
		case 'dislike':
			return <ThumbsDownIcon />;
		case 'hate':
			return <BrokenHeartIcon />;
	}
}
