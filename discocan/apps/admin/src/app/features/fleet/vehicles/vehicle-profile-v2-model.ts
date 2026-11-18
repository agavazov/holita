import type {
  AdminVehicleProblemDetailsFragment,
  AdminVehicleProfileProblemsQuery,
} from '../../../../generated/graphql/operations';

export type VehicleProblem = AdminVehicleProblemDetailsFragment;
export type VehicleProblemCounts = AdminVehicleProfileProblemsQuery['fleetProblems']['counts'];
