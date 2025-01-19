export interface Course {
    course_id: string;
    course_name: string;
    etcs: number;
    grades: Grade[];
    passing_status: boolean;
    termId: string;
}
export interface Grade {
    value: number;
    value_description: string;
    value_symbol: string;
    counts_into_average: number;
}
export interface Term{
    id: string;
    name: string;
    is_current: boolean;
    start_date: string;
    end_date: string;

}
export interface GradesTotal {
    courses:Course[];
    terms: Term[]
}