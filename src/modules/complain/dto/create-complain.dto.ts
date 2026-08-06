import { IsNotEmpty, IsString, IsEnum } from "class-validator";

export enum ComplainCategory {
    ORDER = 'ORDER',
    DELIVERY = 'DELIVERY',
    TECHNICAL_ISSUE = 'TECHNICAL_ISSUE',
    PAYMENT = 'PAYMENT',
    VERIFICATION = 'VERIFICATION',
    OTHER = 'OTHER' // Added fallback category standard
}

export class CreateComplainDto {
    @IsString()
    @IsNotEmpty()
    title!: string;

    @IsString()
    @IsNotEmpty()
    body!: string;

    @IsEnum(ComplainCategory, {
        message: 'Category must be one of the following: ORDER, DELIVERY, TECHNICAL_ISSUE, PAYMENT, VERIFICATION, OTHER'
    })
    @IsNotEmpty()
    category!: ComplainCategory;
}