import { SurveyQuestionType } from '@mentalhelpglobal/chat-types';
import type { SurveyQuestion, SurveyAnswer } from '@mentalhelpglobal/chat-types';
import FreeTextInput from './FreeTextInput';
import SingleChoiceInput from './SingleChoiceInput';
import MultiChoiceInput from './MultiChoiceInput';
import BooleanInput from './BooleanInput';

interface Props {
  question: SurveyQuestion;
  answer: SurveyAnswer | undefined;
  onAnswer: (value: SurveyAnswer['value']) => void;
  onFreetext?: (optionLabel: string, value: string) => void;
  freetextValues?: Record<string, string>;
}

export default function QuestionRenderer({ question, answer, onAnswer, onFreetext, freetextValues }: Props) {
  const value = answer?.value ?? null;
  const type = question.type;

  switch (type) {
    case SurveyQuestionType.FREE_TEXT:
    case SurveyQuestionType.INTEGER_SIGNED:
    case SurveyQuestionType.INTEGER_UNSIGNED:
    case SurveyQuestionType.DECIMAL:
    case SurveyQuestionType.DATE:
    case SurveyQuestionType.TIME:
    case SurveyQuestionType.DATETIME:
    case SurveyQuestionType.EMAIL:
    case SurveyQuestionType.PHONE:
    case SurveyQuestionType.URL:
    case SurveyQuestionType.POSTAL_CODE:
    case SurveyQuestionType.ALPHANUMERIC_CODE:
    case SurveyQuestionType.RATING_SCALE:
      return (
        <FreeTextInput
          question={question}
          value={typeof value === 'string' ? value : ''}
          onChange={onAnswer}
        />
      );
    case SurveyQuestionType.SINGLE_CHOICE:
      return (
        <SingleChoiceInput
          question={question}
          value={typeof value === 'string' ? value : null}
          onChange={onAnswer}
          optionConfigs={question.optionConfigs ?? undefined}
          onFreetext={onFreetext}
          freetextValues={freetextValues}
        />
      );
    case SurveyQuestionType.MULTI_CHOICE:
      return (
        <MultiChoiceInput
          question={question}
          value={Array.isArray(value) ? value : []}
          onChange={onAnswer}
          optionConfigs={question.optionConfigs ?? undefined}
          onFreetext={onFreetext}
          freetextValues={freetextValues}
        />
      );
    case SurveyQuestionType.BOOLEAN:
      return (
        <BooleanInput
          question={question}
          value={typeof value === 'boolean' ? value : null}
          onChange={onAnswer}
        />
      );
    default:
      return <p className="text-gray-500">Unsupported question type</p>;
  }
}
