export default {
  lineClamp: {
    style: (props: Record<string, unknown>) => {
      const lineClampValue =
        typeof props.lineClamp === 'number' || typeof props.lineClamp === 'string'
          ? props.lineClamp
          : 1;

      return {
        display: '-webkit-box',
        WebkitLineClamp: String(lineClampValue),
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      };
    },
  },
};
