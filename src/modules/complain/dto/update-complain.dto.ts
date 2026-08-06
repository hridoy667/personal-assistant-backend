import { IsOptional, IsString, IsEnum } from "class-validator";
import { ComplainCategory } from "./create-complain.dto"; // Adjust import path
import { complainStatus } from "@prisma/client";
export class UpdateComplainDto {
    @IsOptional()
    @IsString()
    title?: string;

    @IsOptional()
    @IsString()
    body?: string;

    @IsOptional()
    @IsEnum(ComplainCategory)
    category?: ComplainCategory;

    @IsOptional()
    @IsEnum(complainStatus)
    status?: complainStatus;

    @IsOptional()
    @IsString()
    solution?: string;
}