interface Props {
	formId: string;
	disabled: boolean;
}

export function AddActivityButton({ formId, disabled }: Props) {
	return (
		<button type="submit" form={formId} className="btn btn-primary" disabled={disabled}>
			Add
		</button>
	);
}
