#include<stdio.h>
#include<math.h>
#include<conio.h>
int main()
{
    int length, width, area;
    printf("Enter the length of the rectangle: ");
    scanf("%d", &length);
    printf("Enter the width of the rectangle: ");
    scanf("%d", &width);
    
    area = length * width;
    
    printf("The area of the rectangle is: %d", area);
    getch();
    return 0;
}